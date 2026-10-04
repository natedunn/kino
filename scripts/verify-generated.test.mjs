import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(new URL('./verify-generated.sh', import.meta.url));

async function fixture(t) {
	const directory = await mkdtemp(path.join(tmpdir(), 'kino-verify-generated-'));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const run = (command, args) => spawnSync(command, args, { cwd: directory, encoding: 'utf8' });
	for (const args of [
		['init', '--quiet'],
		['config', 'user.email', 'test@example.test'],
		['config', 'user.name', 'Test'],
	]) {
		assert.equal(run('git', args).status, 0);
	}
	await mkdir(path.join(directory, 'convex/native/_generated/ai'), { recursive: true });
	await mkdir(path.join(directory, 'scripts'));
	await mkdir(path.join(directory, 'bin'));
	await copyFile(scriptPath, path.join(directory, 'scripts/verify-generated.sh'));
	await writeFile(path.join(directory, 'convex/native/_generated/api.d.ts'), 'export {};\n');
	await writeFile(path.join(directory, 'convex/native/_generated/ai/ai-files.state.json'), '{}\n');
	// Exercise the real Git cleanliness gate without contacting a deployment.
	await writeFile(path.join(directory, 'bin/pnpm'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
	assert.equal(run('git', ['add', '.']).status, 0);
	assert.equal(run('git', ['commit', '--quiet', '-m', 'fixture']).status, 0);
	return {
		directory,
		verify: () =>
			spawnSync('bash', ['scripts/verify-generated.sh'], {
				cwd: directory,
				encoding: 'utf8',
				env: {
					...process.env,
					PATH: `${path.join(directory, 'bin')}${path.delimiter}${process.env.PATH}`,
				},
			}),
	};
}

test('AI guidance changes and untracked tooling files do not fail runtime verification', async (t) => {
	const { directory, verify } = await fixture(t);
	await writeFile(
		path.join(directory, 'convex/native/_generated/ai/ai-files.state.json'),
		'{"updated":true}\n'
	);
	await writeFile(
		path.join(directory, 'convex/native/_generated/ai/new-guidance.md'),
		'Tooling docs\n'
	);
	const result = verify();
	assert.equal(result.status, 0, result.stdout + result.stderr);
	assert.match(result.stdout, /Generated application files are up to date/);
});

for (const change of ['modified', 'untracked', 'deleted']) {
	test(`${change} application output still fails verification alongside AI changes`, async (t) => {
		const { directory, verify } = await fixture(t);
		await writeFile(
			path.join(directory, 'convex/native/_generated/ai/ai-files.state.json'),
			'{"updated":true}\n'
		);
		const apiPath = path.join(directory, 'convex/native/_generated/api.d.ts');
		if (change === 'modified') await writeFile(apiPath, 'export const stale = true;\n');
		if (change === 'untracked')
			await writeFile(
				path.join(directory, 'convex/native/_generated/new-runtime.ts'),
				'export {};\n'
			);
		if (change === 'deleted') await rm(apiPath);
		const result = verify();
		assert.equal(result.status, 1, result.stdout + result.stderr);
		assert.match(result.stderr, /Generated application files are out of date/);
		assert.match(result.stderr, change === 'untracked' ? /new-runtime\.ts/ : /api\.d\.ts/);
		assert.doesNotMatch(result.stderr, /ai-files\.state\.json/);
	});
}
