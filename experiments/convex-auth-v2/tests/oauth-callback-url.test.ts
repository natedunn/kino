// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';

import { api } from '../.revocation/packages/core/src/oauth/component/_generated/api';
import schema from '../.revocation/packages/core/src/oauth/component/schema';

const modules = import.meta.glob('../.revocation/packages/core/src/oauth/component/**/*.ts');
const args = {
	providerName: 'github',
	stateHash: '0'.repeat(64),
	redirectTo: 'https://app.test/return',
	tokenEndpoint: 'https://github.com/login/oauth/access_token',
};
function setup() {
	vi.stubEnv('CLIENT_ID', 'proof');
	vi.stubEnv('CONVEX_SITE_URL', 'https://backend.convex.site/oauth/github');
	vi.stubEnv('CALLBACK_URL', undefined);
	return convexTest(schema, modules);
}
afterEach(() => vi.unstubAllEnvs());
test('unset override preserves the official component callback URL', async () => {
	const t = setup();
	expect((await t.mutation(api.provider.createAuthorizationRequest, args)).callbackUrl).toBe(
		'https://backend.convex.site/oauth/github/callback'
	);
});
test('server-configured public callback is stored for the later code exchange', async () => {
	const t = setup();
	vi.stubEnv('CALLBACK_URL', 'https://gateway.test/oauth/github/callback');
	expect((await t.mutation(api.provider.createAuthorizationRequest, args)).callbackUrl).toBe(
		'https://gateway.test/oauth/github/callback'
	);
	expect(
		await t.run(async (ctx) => (await ctx.db.query('authorizationRequests').first())?.callbackUrl)
	).toBe('https://gateway.test/oauth/github/callback');
});
test.each([
	'http://remote.test/callback',
	'javascript:alert(1)',
	'https://user:password@gateway.test/callback',
	'https://gateway.test/callback?target=evil',
	'https://gateway.test/callback#fragment',
])('rejects unsafe configured callback %s', async (url) => {
	const t = setup();
	vi.stubEnv('CALLBACK_URL', url);
	await expect(t.mutation(api.provider.createAuthorizationRequest, args)).rejects.toThrow(
		'CALLBACK_URL'
	);
	expect(await t.run((ctx) => ctx.db.query('authorizationRequests').collect())).toEqual([]);
});
