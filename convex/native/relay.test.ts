// @vitest-environment edge-runtime
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { configureTestAuth, issuer } from '../testing/setup.testing';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.testing.ts']);
beforeEach(async () => {
	await configureTestAuth();
	for (const key of [
		'APP_ID',
		'CLIENT_ID',
		'CLIENT_SECRET',
		'PRIVATE_KEY',
		'SLUG',
		'STATE_SECRET',
		'WEBHOOK_SECRET',
	])
		vi.stubEnv(`GITHUB_RELAY_${key}`, 'test');
});
afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	vi.useRealTimers();
});
async function fixture() {
	const t = convexTest(schema, modules);
	registerRateLimiter(t, 'authLimits');
	const ids = await t.run(async (ctx) => {
		const user = await ctx.db.insert('users', { status: 'active', systemRole: 'user' }),
			other = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const profile = await ctx.db.insert('profiles', {
			userId: user,
			name: 'Owner',
			username: 'owner',
		});
		await ctx.db.patch('users', user, { profileId: profile });
		const org = await ctx.db.insert('organizations', {
			name: 'Org',
			slug: 'org',
			visibility: 'public',
		});
		const member = await ctx.db.insert('memberships', {
			organizationId: org,
			userId: user,
			role: 'owner',
		});
		const project = await ctx.db.insert('projects', {
			organizationId: org,
			name: 'Project',
			slug: 'project',
			visibility: 'public',
		});
		const board = await ctx.db.insert('feedbackBoards', {
			projectId: project,
			name: 'Board',
			slug: 'board',
		});
		const feedback = await ctx.db.insert('feedback', {
			projectId: project,
			boardId: board,
			authorProfileId: profile,
			slug: 'feedback',
			title: 'Feedback',
			status: 'open',
			priority: 'none',
			upvotes: 0,
			tags: [],
			searchContent: 'feedback',
			updatedAt: Date.now(),
		});
		return { user, other, profile, org, member, project, feedback };
	});
	const owner = t.withIdentity({ subject: ids.user, issuer }),
		other = t.withIdentity({ subject: ids.other, issuer });
	const start = async () => {
		const { url } = await owner.mutation(api.relay.start, { orgSlug: 'org' });
		return new URL(url).searchParams.get('state')!;
	};
	return { t, ids, owner, other, start };
}
const installation = {
	id: 123,
	account: { id: 44, login: 'account', type: 'Organization' },
	events: ['issues'],
	permissions: { issues: 'write' },
	repository_selection: 'selected',
};
const repository = {
	id: 456,
	node_id: 'REPO',
	name: 'repo',
	full_name: 'account/repo',
	private: true,
	owner: { login: 'account' },
};
async function connected() {
	const f = await fixture();
	await f.t.mutation(internal.relay.complete, {
		state: await f.start(),
		installations: [{ installation, authorizedRepositoryIds: [] }],
		deletedInstallationIds: [],
	});
	const row = (await f.owner.query(api.relay.integration, { orgSlug: 'org' })).installations[0];
	const { connectionId } = await f.owner.mutation(internal.relay.saveRepository, {
		orgSlug: 'org',
		projectSlug: 'project',
		installationId: 123,
		installationRowId: row.id,
		repository,
		mode: 'read_write',
		enabledSources: ['issues'],
		verificationSummary: { issues: { ok: true }, discussions: { ok: false, enabled: false } },
	});
	return { ...f, connectionId, installationId: row.id };
}

test('state is exact-origin, expiring, single-use, and rechecks initiating membership', async () => {
	const f = await fixture();
	await expect(f.other.mutation(api.relay.start, { orgSlug: 'org' })).rejects.toThrow();
	await expect(
		f.owner.mutation(api.relay.start, {
			orgSlug: 'org',
			callbackTargetUrl: 'https://evil.test/api/github/callback',
		})
	).rejects.toThrow();
	const state = await f.start();
	const args = {
		state,
		installations: [{ installation, authorizedRepositoryIds: [] }],
		deletedInstallationIds: [],
	};
	await f.t.mutation(internal.relay.complete, args);
	await expect(f.t.mutation(internal.relay.complete, args)).rejects.toThrow();
	const revoked = await f.start();
	await f.t.run((ctx) => ctx.db.patch('memberships', f.ids.member, { role: 'moderator' }));
	await expect(
		f.t.mutation(internal.relay.complete, { ...args, state: revoked })
	).rejects.toThrow();
	await f.t.run((ctx) => ctx.db.patch('memberships', f.ids.member, { role: 'owner' }));
	const expired = await f.start();
	vi.useFakeTimers();
	vi.advanceTimersByTime(600_001);
	await expect(
		f.t.mutation(internal.relay.complete, { ...args, state: expired })
	).rejects.toThrow();
});
test('repository conflict, revoked installation and archived project block writes', async () => {
	const f = await connected();
	await expect(f.other.query(api.relay.integration, { orgSlug: 'org' })).rejects.toThrow();
	await f.t.run((ctx) =>
		ctx.db.insert('projects', {
			organizationId: f.ids.org,
			name: 'Second',
			slug: 'second',
			visibility: 'public',
		})
	);
	const args = {
		orgSlug: 'org',
		projectSlug: 'second',
		installationId: 123,
		installationRowId: f.installationId,
		repository,
		mode: 'read' as const,
		enabledSources: ['issues' as const],
		verificationSummary: { issues: { ok: true }, discussions: { ok: false, enabled: false } },
	};
	await expect(f.owner.mutation(internal.relay.saveRepository, args)).rejects.toThrow(
		'already connected'
	);
	await f.t.run((ctx) => ctx.db.patch('projects', f.ids.project, { visibility: 'archived' }));
	await expect(
		f.owner.mutation(api.relay.disconnectRepository, {
			orgSlug: 'org',
			projectSlug: 'project',
			connectionId: f.connectionId,
		})
	).rejects.toThrow('PROJECT_ARCHIVED');
	await f.t.run((ctx) => ctx.db.patch('projects', f.ids.project, { visibility: 'public' }));
	await f.t.mutation(internal.relay.stale, { id: f.installationId });
	await expect(
		f.owner.query(internal.relay.installationContext, { orgSlug: 'org', installationId: 123 })
	).rejects.toThrow();
});
test('reinstall reconciliation repairs authorized repositories and revokes removed ones', async () => {
	const f = await connected();
	await f.t.mutation(internal.relay.stale, { id: f.installationId });
	await f.t.mutation(internal.relay.complete, {
		state: await f.start(),
		installations: [{ installation: { ...installation, id: 124 }, authorizedRepositoryIds: [456] }],
		deletedInstallationIds: [],
	});
	let data = await f.owner.query(api.relay.integration, { orgSlug: 'org', projectSlug: 'project' });
	expect(data.installations[0].installationId).toBe(124);
	expect(data.connections[0].githubInstallationId).toBe(data.installations[0].id);
	await f.t.mutation(internal.relay.complete, {
		state: await f.start(),
		installations: [{ installation: { ...installation, id: 124 }, authorizedRepositoryIds: [] }],
		deletedInstallationIds: [],
	});
	data = await f.owner.query(api.relay.integration, { orgSlug: 'org', projectSlug: 'project' });
	expect(data.connections).toEqual([]);
});
test('webhook signature, tenant/install binding, dedupe, disconnect privacy and cascade', async () => {
	const f = await connected(),
		target = {
			databaseId: 1,
			nodeId: 'ISSUE',
			number: 1,
			title: 'Issue',
			state: 'open',
			url: 'https://github.com/account/repo/issues/1',
		};
	await f.owner.mutation(internal.relayFeedback.save, {
		feedbackId: f.ids.feedback,
		connectionId: f.connectionId,
		target,
	});
	expect(
		await f.other.query(api.relayFeedback.listByFeedback, { feedbackId: f.ids.feedback })
	).toEqual([]);
	const issue = {
		repositoryId: 456,
		nodeId: 'ISSUE',
		number: 1,
		title: 'Changed',
		state: 'closed',
		url: target.url,
	};
	expect(
		(
			await f.t.mutation(internal.relay.webhook, {
				deliveryId: 'unknown',
				event: 'issues',
				installationId: 999,
				issue,
			})
		).result
	).toBe('ignored');
	const event = { deliveryId: 'known', event: 'issues', installationId: 123, issue };
	expect((await f.t.mutation(internal.relay.webhook, event)).result).toBe('processed');
	expect((await f.t.mutation(internal.relay.webhook, event)).duplicate).toBe(true);
	expect(
		(await f.owner.query(api.relayFeedback.listByFeedback, { feedbackId: f.ids.feedback }))[0].state
	).toBe('closed');
	const response = await f.t.fetch('/api/github/webhook', {
		method: 'POST',
		headers: { 'x-hub-signature-256': 'sha256=invalid' },
		body: '{}',
	});
	expect(response.status).toBe(401);
	await f.owner.mutation(api.relay.disconnectRepository, {
		orgSlug: 'org',
		projectSlug: 'project',
		connectionId: f.connectionId,
	});
	expect(
		await f.owner.query(api.relayFeedback.listByFeedback, { feedbackId: f.ids.feedback })
	).toEqual([]);
	await expect(
		f.owner.query(internal.relayFeedback.context, { feedbackId: f.ids.feedback })
	).rejects.toThrow();
	vi.useFakeTimers();
	await f.owner.mutation(api.feedback.remove, { feedbackId: f.ids.feedback });
	await f.t.finishAllScheduledFunctions(vi.runAllTimers);
	expect(await f.t.run((ctx) => ctx.db.query('relayIssues').take(10))).toEqual([]);
});

test('HTTP callback consumes valid state, rejects replay before exchange, and redirects home', async () => {
	const f = await fixture(),
		state = await f.start();
	const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
		const url = String(input);
		if (url === 'https://github.com/login/oauth/access_token')
			return Response.json({ access_token: 'test-user-token' });
		if (url.startsWith('https://api.github.com/user/installations'))
			return Response.json({ total_count: 1, installations: [installation] });
		throw new Error('Unexpected network call');
	});
	const path = `/api/github/callback?state=${encodeURIComponent(state)}&code=test-code`;
	const result = await f.t.fetch(path);
	expect(result.status).toBe(302);
	expect(result.headers.get('location')).toBe(
		'https://native.example.test/org/settings/integrations?org=org&github=connected'
	);
	expect(
		(await f.owner.query(api.relay.integration, { orgSlug: 'org' })).installations
	).toHaveLength(1);
	const count = fetchMock.mock.calls.length;
	const replay = await f.t.fetch(path);
	expect(replay.headers.get('location')).toContain('github=error');
	expect(fetchMock.mock.calls).toHaveLength(count);
});
test('signed repository removal is deduplicated and installation suspension blocks issue access', async () => {
	const f = await connected();
	await f.t.mutation(internal.relay.webhook, {
		deliveryId: 'suspend',
		event: 'installation',
		action: 'suspend',
		installationId: 123,
	});
	await expect(
		f.owner.query(internal.relayFeedback.context, { feedbackId: f.ids.feedback })
	).rejects.toThrow();
	await f.t.mutation(internal.relay.webhook, {
		deliveryId: 'unsuspend',
		event: 'installation',
		action: 'unsuspend',
		installationId: 123,
	});
	const body = JSON.stringify({
		action: 'removed',
		installation: { id: 123 },
		repositories_removed: [{ id: 456 }],
	});
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode('test'),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = Array.from(
		new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))),
		(b) => b.toString(16).padStart(2, '0')
	).join('');
	const options = {
		method: 'POST',
		body,
		headers: {
			'x-github-delivery': 'removed-http',
			'x-github-event': 'installation_repositories',
			'x-hub-signature-256': `sha256=${signature}`,
		},
	};
	expect(await (await f.t.fetch('/api/github/webhook', options)).json()).toMatchObject({
		ok: true,
		result: 'processed',
		duplicate: false,
	});
	expect(await (await f.t.fetch('/api/github/webhook', options)).json()).toMatchObject({
		duplicate: true,
	});
	expect(
		(await f.owner.query(api.relay.integration, { orgSlug: 'org', projectSlug: 'project' }))
			.connections
	).toEqual([]);
});

test('repository verification and issue actions use scoped GitHub tokens and recheck writes', async () => {
	const f = await connected();
	vi.stubEnv('GITHUB_RELAY_PRIVATE_KEY', atob(process.env.AUTH_PRIVATE_KEY!));
	const writes: Array<string> = [];
	vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
		const url = String(input);
		if (url.endsWith('/access_tokens')) {
			const body = JSON.parse(String(init?.body));
			expect(body.repository_ids).toEqual([456]);
			return Response.json({ token: 'installation-token', expires_at: '2099-01-01T00:00:00Z' });
		}
		if (url.includes('/installation/repositories'))
			return Response.json({ total_count: 1, repositories: [repository] });
		if (url.endsWith('/graphql'))
			return Response.json({ data: { repository: { hasDiscussionsEnabled: false } } });
		if (url.includes('/issues?')) return Response.json([]);
		if (url.endsWith('/issues') && init?.method === 'POST') {
			writes.push(url);
			return Response.json({
				id: 99,
				node_id: 'CREATED',
				number: 9,
				state: 'open',
				title: 'Created',
				html_url: 'https://github.com/account/repo/issues/9',
			});
		}
		throw new Error(`Unexpected request ${url}`);
	});
	await f.owner.action(api.relayActions.connectRepository, {
		orgSlug: 'org',
		projectSlug: 'project',
		installationId: 123,
		repoId: 456,
		mode: 'read_write',
		enabledSources: ['issues'],
	});
	await f.owner.action(api.relayFeedbackActions.connect, {
		feedbackId: f.ids.feedback,
		kind: 'issue',
		title: 'Created',
		body: 'Body',
		feedbackUrl: 'https://native.example.test/@org/project/feedback/feedback',
	});
	expect(writes).toHaveLength(1);
	expect(
		(await f.owner.query(api.relayFeedback.listByFeedback, { feedbackId: f.ids.feedback }))[0]
			.githubNumber
	).toBe(9);
	await expect(
		f.other.action(api.relayFeedbackActions.connect, {
			feedbackId: f.ids.feedback,
			kind: 'issue',
			title: 'Forbidden',
			feedbackUrl: 'https://native.example.test/',
		})
	).rejects.toThrow();
	expect(writes).toHaveLength(1);
});
