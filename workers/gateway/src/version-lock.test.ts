import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { oAuthProxy } from 'better-auth/plugins';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));

/**
 * The gateway keeps Better Auth as a standalone, exact dependency while the
 * legacy oAuthProxy route remains available during the native-auth rollout.
 * This test deliberately has no dependency on the root app package.
 *
 * If this fails after a gateway dependency update, regenerate the gateway's
 * standalone lockfile and deploy the gateway before relying on its legacy route.
 */
describe('better-auth version lock', () => {
	it('uses the exact version declared by the standalone gateway package', () => {
		const gatewayPkg = JSON.parse(readFileSync(resolve(testDir, '../package.json'), 'utf8'));
		const declaredVersion = gatewayPkg.dependencies['better-auth'];

		expect(declaredVersion).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
		expect(oAuthProxy().version).toBe(declaredVersion);
	});
});
