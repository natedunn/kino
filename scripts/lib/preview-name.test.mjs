import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { previewName } from './preview-name.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

function shellPreviewName(args, env = {}) {
	const result = spawnSync('sh', ['scripts/preview-name.sh', ...args], {
		cwd: repoRoot,
		encoding: 'utf8',
		env: { PATH: process.env.PATH, ...env },
	});
	assert.equal(result.status, 0, result.stderr);
	return result.stdout.trim();
}

const cases = [
	['main', 48, 'main'],
	['t3code/add-project-discussions', 40, 't3code-add-project-discussions'],
	['Fix/Some_Branch.Name', 48, 'fix-some-branch-name'],
	['--feature//double__sep--', 48, 'feature-double-sep'],
	['', 48, 'preview'],
	['///', 40, 'preview'],
	// 50 characters: truncated at both lengths.
	[
		'feature/a-really-long-branch-name-that-keeps-going',
		40,
		'feature-a-really-long-branch-name-that-k',
	],
	[
		'feature/a-really-long-branch-name-that-keeps-going',
		48,
		'feature-a-really-long-branch-name-that-keeps-goi',
	],
	// Exactly at the limit: nothing to trim.
	['abcdefghijklmnopqrstuvwxyz-0123456789abc/rest', 40, 'abcdefghijklmnopqrstuvwxyz-0123456789abc'],
	[
		'abcdefghijklmnopqrstuvwxyz-0123456789abcdefghijk_rest',
		48,
		'abcdefghijklmnopqrstuvwxyz-0123456789abcdefghijk',
	],
	// The cut lands on a separator: the trailing `-` is trimmed after truncating.
	['abcdefghijklmnopqrstuvwxyz-0123456789ab/rest', 40, 'abcdefghijklmnopqrstuvwxyz-0123456789ab'],
	[
		'abcdefghijklmnopqrstuvwxyz-0123456789abcdefghij_rest',
		48,
		'abcdefghijklmnopqrstuvwxyz-0123456789abcdefghij',
	],
	// Only ASCII letters are lowercased, matching the original `tr`-based script.
	['KKelvin', 48, 'k-elvin'],
];

for (const [branch, maxLength, expected] of cases) {
	test(`previewName(${JSON.stringify(branch)}, ${maxLength})`, () => {
		const name = previewName(branch, maxLength);
		assert.equal(name, expected);
		assert.ok(name.length <= maxLength);
		assert.match(name, /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);
	});
}

test('preview-name.sh delegates to the shared implementation', () => {
	for (const [branch, maxLength, expected] of cases.filter(([branch]) => branch)) {
		assert.equal(shellPreviewName([branch, String(maxLength)]), expected);
	}
	assert.equal(shellPreviewName(['Some/Branch']), 'some-branch');
});

test('preview-name.sh detects the branch from Workers Builds first', () => {
	assert.equal(
		shellPreviewName([], { WORKERS_CI_BRANCH: 'feature/X', BRANCH: 'other' }),
		'feature-x'
	);
	assert.equal(shellPreviewName([], { BRANCH: 'manual/Override' }), 'manual-override');
});

test('preview-name.sh rejects an invalid length', () => {
	const result = spawnSync('sh', ['scripts/preview-name.sh', 'main', 'abc'], {
		cwd: repoRoot,
		encoding: 'utf8',
	});
	assert.notEqual(result.status, 0);
});
