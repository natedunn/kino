import { describe, expect, it } from 'vitest';

import {
	classifyDevCommand,
	findLiveSupervisors,
	liveSessionMessage,
	parseDevSessionState,
	parseProcessTable,
	selectOrphanedDevPids,
	selectOrphanGroups,
	selectRecordedGroups,
} from './dev-session.mjs';

const root = '/wt/kino-a';
const bin = `${root}/node_modules/.bin/..`;
const workerd = `${root}/node_modules/.pnpm/@cloudflare+workerd-darwin-arm64@1/node_modules/@cloudflare/workerd-darwin-arm64/bin/workerd`;

type Proc = { pid: number; ppid: number; pgid: number; command: string };
const proc = (pid: number, ppid: number, pgid: number, command: string): Proc => ({
	pid,
	ppid,
	pgid,
	command,
});

// A full `pnpm dev` session as it appears in `ps`, rooted at supervisor 100.
function session(supervisorPpid = 90): Array<Proc> {
	return [
		proc(90, 1, 90, 'node /usr/bin/pnpm run dev:anonymous'),
		proc(100, supervisorPpid, 90, 'node scripts/dev-supervisor.mjs'),
		proc(110, 100, 110, `node ${bin}/convex/bin/main.js dev --env-file .convex/anonymous.env`),
		proc(
			111,
			110,
			110,
			`/home/.cache/convex/binaries/x/convex-local-backend --port 20372 --local-storage ${root}/.convex/local/default/convex_local_storage`
		),
		proc(120, 100, 120, `node ${bin}/portless/dist/cli.js kino-a.kino --force pnpm run dev:vite`),
		proc(121, 120, 121, 'node /usr/bin/pnpm run dev:vite'),
		proc(122, 121, 121, `node ${bin}/vite/bin/vite.js dev`),
		proc(123, 122, 121, `${workerd} serve --binary --experimental`),
	];
}

// The same processes after the supervisor was SIGKILLed: its direct children are
// reparented to launchd.
function orphanedSession(): Array<Proc> {
	return session()
		.filter((entry) => entry.pid !== 100 && entry.pid !== 90)
		.map((entry) => (entry.ppid === 100 ? { ...entry, ppid: 1 } : entry));
}

const sessionPids = [110, 111, 120, 122, 123];

describe('classifyDevCommand', () => {
	it('recognizes every dev-session process of this worktree', () => {
		const kinds = session().map((entry) => classifyDevCommand(entry.command, root));
		expect(kinds).toEqual([null, null, 'convex', 'backend', 'portless', null, 'vite', 'workerd']);
	});

	it('accepts a trailing slash on the root', () => {
		expect(classifyDevCommand(`node ${bin}/vite/bin/vite.js dev`, `${root}/`)).toBe('vite');
	});

	it('ignores vite build, preview, and optimize', () => {
		for (const sub of ['build', 'preview', 'optimize']) {
			expect(classifyDevCommand(`node ${bin}/vite/bin/vite.js ${sub}`, root)).toBeNull();
		}
		expect(classifyDevCommand(`node ${bin}/vite/bin/vite.js`, root)).toBe('vite');
		expect(classifyDevCommand(`node ${bin}/vite/bin/vite.js --port 4000`, root)).toBe('vite');
		expect(classifyDevCommand(`node ${bin}/vite/bin/vite.js serve`, root)).toBe('vite');
	});

	it('never matches the shared portless proxy or other portless subcommands', () => {
		expect(
			classifyDevCommand(
				`node ${bin}/portless/dist/cli.js proxy start --foreground --port 1355 --https`,
				root
			)
		).toBeNull();
		expect(
			classifyDevCommand(
				'node /usr/lib/node_modules/portless/dist/cli.js proxy start --port 1355',
				root
			)
		).toBeNull();
		expect(classifyDevCommand(`node ${bin}/portless/dist/cli.js prune --force`, root)).toBeNull();
	});

	it('ignores convex commands other than `convex dev`', () => {
		expect(classifyDevCommand(`node ${bin}/convex/bin/main.js deploy`, root)).toBeNull();
		expect(classifyDevCommand(`node ${bin}/convex/bin/main.js env set X 1`, root)).toBeNull();
	});

	it('does not match a sibling worktree that shares a path prefix', () => {
		const sibling = '/wt/kino-a-2';
		expect(
			classifyDevCommand(`node ${sibling}/node_modules/.bin/../vite/bin/vite.js dev`, root)
		).toBeNull();
		expect(
			classifyDevCommand(
				`convex-local-backend --local-storage ${sibling}/.convex/local/default/x`,
				root
			)
		).toBeNull();
	});

	it('does not match a worktree nested under this one', () => {
		const nested = `${root}/.claude/worktrees/feature`;
		expect(
			classifyDevCommand(`node ${nested}/node_modules/.bin/../vite/bin/vite.js dev`, root)
		).toBeNull();
		expect(
			classifyDevCommand(
				`node ${nested}/node_modules/.bin/../convex/bin/main.js dev --env-file x`,
				root
			)
		).toBeNull();
		expect(
			classifyDevCommand(
				`convex-local-backend --local-storage ${nested}/.convex/local/default/x`,
				root
			)
		).toBeNull();
		// ...while the nested worktree itself still matches its own processes.
		expect(
			classifyDevCommand(`node ${nested}/node_modules/.bin/../vite/bin/vite.js dev`, nested)
		).toBe('vite');
	});
});

describe('selectOrphanedDevPids', () => {
	it('never reaps processes of a live session', () => {
		expect(selectOrphanedDevPids({ processes: session(), workspaceRoot: root })).toEqual([]);
	});

	it('reaps every dev process once the supervisor is gone', () => {
		expect(
			selectOrphanedDevPids({ processes: orphanedSession(), workspaceRoot: root }).sort()
		).toEqual(sessionPids);
	});

	it('only reaps the orphaned half when a new session is also running', () => {
		const live = session().map((entry) => ({
			...entry,
			pid: entry.pid + 1000,
			ppid: entry.ppid > 1 ? entry.ppid + 1000 : 1,
			pgid: entry.pgid + 1000,
		}));
		const processes = [...orphanedSession(), ...live];
		expect(selectOrphanedDevPids({ processes, workspaceRoot: root }).sort()).toEqual(sessionPids);
	});

	it('leaves vite build/preview and wrangler dev in the worktree alone', () => {
		const processes = [
			proc(500, 1, 500, '-zsh'),
			proc(501, 500, 501, 'node /usr/bin/pnpm build'),
			proc(502, 501, 501, `node ${bin}/vite/bin/vite.js build`),
			// A workerd spawned by `vite build` (e.g. prerendering).
			proc(503, 502, 501, `${workerd} serve --binary`),
			proc(510, 500, 510, `node ${bin}/vite/bin/vite.js preview`),
			proc(520, 500, 520, `node ${root}/node_modules/.bin/../wrangler/bin/wrangler.js dev`),
			proc(521, 520, 520, `${workerd} serve --binary --experimental`),
		];
		expect(selectOrphanedDevPids({ processes, workspaceRoot: root })).toEqual([]);
	});

	it('leaves a vite dev server started by hand from a shell alone', () => {
		const processes = [
			proc(500, 1, 500, '-zsh'),
			proc(502, 500, 502, `node ${bin}/vite/bin/vite.js dev`),
		];
		expect(selectOrphanedDevPids({ processes, workspaceRoot: root })).toEqual([]);
	});

	it('leaves the backend of a running `convex:local:init` alone', () => {
		const processes = [
			proc(600, 1, 600, 'node scripts/init-native-local.mjs'),
			proc(601, 600, 601, `node ${bin}/convex/bin/main.js dev --until-success --env-file x`),
			proc(602, 601, 601, `convex-local-backend --local-storage ${root}/.convex/local/default/s`),
		];
		expect(selectOrphanedDevPids({ processes, workspaceRoot: root })).toEqual([]);
	});

	it('never reaps the portless proxy daemon even when it is orphaned', () => {
		const processes = [
			proc(700, 1, 700, `node ${bin}/portless/dist/cli.js proxy start --port 1355 --https`),
		];
		expect(selectOrphanedDevPids({ processes, workspaceRoot: root })).toEqual([]);
	});

	it('ignores orphans that belong to other worktrees', () => {
		const other = orphanedSession().map((entry) => ({
			...entry,
			command: entry.command.replaceAll(root, `${root}/.claude/worktrees/x`),
		}));
		expect(selectOrphanedDevPids({ processes: other, workspaceRoot: root })).toEqual([]);
	});

	it('honors excluded pids', () => {
		expect(
			selectOrphanedDevPids({
				processes: orphanedSession(),
				workspaceRoot: root,
				excludePids: [110, 111],
			}).sort()
		).toEqual([120, 122, 123]);
	});
});

describe('selectOrphanGroups', () => {
	it('includes groups led by orphaned dev processes and their pnpm wrapper', () => {
		const processes = orphanedSession();
		const orphanPids = selectOrphanedDevPids({ processes, workspaceRoot: root });
		expect(selectOrphanGroups({ processes, orphanPids, workspaceRoot: root }).sort()).toEqual([
			110, 120, 121,
		]);
	});

	it('skips excluded groups and groups led by a foreign process', () => {
		const processes = [
			proc(500, 1, 500, '-zsh'),
			proc(502, 1, 500, `node ${bin}/vite/bin/vite.js dev`),
			...orphanedSession(),
		];
		const orphanPids = selectOrphanedDevPids({ processes, workspaceRoot: root });
		expect(orphanPids).toContain(502);
		expect(
			selectOrphanGroups({ processes, orphanPids, workspaceRoot: root, excludePgids: [110] }).sort()
		).toEqual([120, 121]);
	});
});

describe('findLiveSupervisors', () => {
	const cwds: Record<number, string> = { 100: root, 200: '/wt/kino-b', 300: `${root}-2` };
	const cwdOf = (pid: number) => cwds[pid] ?? null;
	const processes = [
		...session(),
		proc(200, 1, 200, 'node scripts/dev-supervisor.mjs'),
		proc(300, 1, 300, 'node scripts/dev-supervisor.mjs'),
	];
	const state = parseDevSessionState(
		JSON.stringify({ workspaceRoot: root, supervisorPid: 100, children: [] }),
		root
	);

	it('finds the recorded live supervisor for this worktree only', () => {
		expect(
			findLiveSupervisors({ processes, state, workspaceRoot: root, cwdOf, selfPid: 999 })
		).toEqual([100]);
	});

	it('finds an unrecorded supervisor started by older code', () => {
		expect(
			findLiveSupervisors({ processes, state: null, workspaceRoot: root, cwdOf, selfPid: 999 })
		).toEqual([100]);
	});

	it('treats a recorded supervisor that is gone as stale', () => {
		const withoutSupervisor = processes.filter((entry) => entry.pid !== 100);
		expect(
			findLiveSupervisors({
				processes: withoutSupervisor,
				state,
				workspaceRoot: root,
				cwdOf,
				selfPid: 999,
			})
		).toEqual([]);
	});

	it('treats a recycled pid that is no longer a supervisor as stale', () => {
		const recycled = processes.map((entry) =>
			entry.pid === 100 ? { ...entry, command: 'node some-other-script.js' } : entry
		);
		expect(
			findLiveSupervisors({ processes: recycled, state, workspaceRoot: root, cwdOf, selfPid: 999 })
		).toEqual([]);
	});

	it('never reports the calling supervisor itself', () => {
		expect(
			findLiveSupervisors({ processes, state, workspaceRoot: root, cwdOf, selfPid: 100 })
		).toEqual([]);
	});

	it('produces an actionable refusal message', () => {
		expect(liveSessionMessage([100])).toBe(
			'dev is already running in this worktree (pid 100); stop it with `pnpm dev:stop` first'
		);
	});
});

describe('session state', () => {
	it('rejects state recorded for a different worktree or malformed state', () => {
		const text = JSON.stringify({ workspaceRoot: root, supervisorPid: 100, children: [] });
		expect(parseDevSessionState(text, '/wt/kino-b')).toBeNull();
		expect(parseDevSessionState('{not json', root)).toBeNull();
		expect(
			parseDevSessionState(JSON.stringify({ workspaceRoot: root, supervisorPid: 1 }), root)
		).toBeNull();
	});

	it('drops malformed child entries', () => {
		const state = parseDevSessionState(
			JSON.stringify({
				workspaceRoot: root,
				supervisorPid: 100,
				children: [{ name: 'convex', pgid: 110 }, { name: 'bad', pgid: 'x' }, { pgid: 1 }],
			}),
			root
		);
		expect(state?.children).toEqual([{ name: 'convex', pgid: 110 }]);
	});

	it("only signals recorded groups that still hold this worktree's dev processes", () => {
		const state = parseDevSessionState(
			JSON.stringify({
				workspaceRoot: root,
				supervisorPid: 100,
				children: [
					{ name: 'convex', pgid: 110 },
					{ name: 'vite', pgid: 120 },
					{ name: 'recycled', pgid: 800 },
					{ name: 'gone', pgid: 900 },
				],
			}),
			root
		);
		const processes = [...orphanedSession(), proc(800, 1, 800, 'node /some/unrelated/app.js')];
		expect(selectRecordedGroups({ state, processes, workspaceRoot: root })).toEqual([110, 120]);
	});
});

describe('parseProcessTable', () => {
	it('parses `ps -o pid=,ppid=,pgid=,command=` output', () => {
		expect(
			parseProcessTable(
				'  100     1   100 node scripts/dev-supervisor.mjs\n\n  110   100   110 node x.js dev\n'
			)
		).toEqual([
			proc(100, 1, 100, 'node scripts/dev-supervisor.mjs'),
			proc(110, 100, 110, 'node x.js dev'),
		]);
	});
});
