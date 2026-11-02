import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
// Kino follows npm beta and stable releases of Convex Auth v2, pinned exactly
// (docs/convex-auth-v2-maintenance.md, "Release policy").
const expectedVersion = '2.0.0-beta.0';

assert.equal(
	packageJson.dependencies?.['@convex-dev/auth'],
	expectedVersion,
	'@convex-dev/auth must be pinned to the exact reviewed npm release'
);
assert.equal(
	packageJson.dependencies?.convex,
	'1.46.0',
	'Convex Auth v2 requires the tested Convex 1.46.0 runtime'
);

const authPackageJsonPath = import.meta.resolve('@convex-dev/auth/package.json');
const authRoot = path.dirname(fileURLToPath(authPackageJsonPath));
const installedPackage = JSON.parse(await readFile(fileURLToPath(authPackageJsonPath), 'utf8'));

assert.equal(installedPackage.version, expectedVersion);

const requiredMarkers = [
	['dist/component/public.js', 'revokeUserSessions'],
	['dist/component/_generated/component.d.ts', 'revokeUserSessions'],
	['dist/internal-types/component/_generated/component.d.ts', 'revokeUserSessions'],
	['dist/components/github/convex.config.js', 'CALLBACK_URL'],
	['dist/lib/oauth/dbHelpers.js', 'process.env.CALLBACK_URL'],
	['package.json', '"./components/password/validation"'],
];

for (const [relativePath, marker] of requiredMarkers) {
	const contents = await readFile(path.join(authRoot, relativePath), 'utf8');
	assert.ok(
		contents.includes(marker),
		`${relativePath} is missing the required native auth patch marker ${marker}`
	);
}

console.log('Pinned Convex Auth v2 release and runtime patches verified.');
