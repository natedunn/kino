import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const expectedSpec =
	'github:get-convex/convex-auth#1d105a04d124785441ce655cef33b54103c7bc2e&path:packages/core';

assert.equal(
	packageJson.dependencies?.['@convex-dev/auth'],
	expectedSpec,
	'@convex-dev/auth must stay pinned to the source revision proven by the migration harness'
);
assert.equal(
	packageJson.dependencies?.convex,
	'1.46.0',
	'Convex Auth v2 requires the tested Convex 1.46.0 runtime'
);

const authPackageJsonPath = import.meta.resolve('@convex-dev/auth/package.json');
const authRoot = path.dirname(fileURLToPath(authPackageJsonPath));
const installedPackage = JSON.parse(await readFile(fileURLToPath(authPackageJsonPath), 'utf8'));

assert.equal(installedPackage.version, '2.0.0-alpha.2');

const requiredMarkers = [
	['dist/components/core/schema.js', 'sessionGenerations'],
	['dist/components/core/public.js', 'revokeUserSessions'],
	['dist/components/core/_generated/component.d.ts', 'revokeUserSessions'],
	['dist/components/core/public.js', 'currentGeneration'],
	['dist/oauth/component/convex.config.js', 'CALLBACK_URL'],
	['dist/oauth/shared/dbHelpers.js', 'process.env.CALLBACK_URL'],
];

for (const [relativePath, marker] of requiredMarkers) {
	const contents = await readFile(path.join(authRoot, relativePath), 'utf8');
	assert.ok(
		contents.includes(marker),
		`${relativePath} is missing the required native auth patch marker ${marker}`
	);
}

console.log('Pinned Convex Auth v2 source and runtime patches verified.');
