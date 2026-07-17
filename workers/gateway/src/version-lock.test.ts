import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));

/**
 * The gateway's better-auth must exactly match the app's better-auth (which is
 * itself pinned by kitcn's exact peer dependency). The oAuthProxy state and
 * profile payloads are symmetric-encrypted; both sides must agree on formats.
 *
 * If this fails after a kitcn upgrade: bump `better-auth` here to the version
 * kitcn now pins, reinstall, and redeploy the gateway before (or with) the app.
 */
describe('better-auth version lock', () => {
	it("matches the app's better-auth version", () => {
		const gatewayPkg = JSON.parse(readFileSync(resolve(testDir, '../package.json'), 'utf8'));
		const appPkg = JSON.parse(readFileSync(resolve(testDir, '../../../package.json'), 'utf8'));

		expect(gatewayPkg.dependencies['better-auth']).toBe(appPkg.dependencies['better-auth']);
	});
});
