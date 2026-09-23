import type { ConvexAuthServerConfig } from '@proof/auth-server';

import { setupConvexAuthServer } from '@proof/auth-server';
import { makeFunctionReference } from 'convex/server';
import { afterEach, expect, test, vi } from 'vitest';

const config: ConvexAuthServerConfig = {
	convexUrl: 'https://proof.convex.cloud',
	refreshSession: makeFunctionReference('auth:refreshSession'),
	signOut: makeFunctionReference('auth:signOut'),
	signIn: [makeFunctionReference('auth:completeEmailVerification')],
	cookieOptions: { secure: true },
};
const routes = setupConvexAuthServer(config);
const call = (path = 'auth:completeEmailVerification', origin = 'https://kino.test') =>
	new Request('https://kino.test/auth/signin?path=/api/mutation', {
		method: 'POST',
		headers: { origin, host: 'kino.test', 'content-type': 'application/json' },
		body: JSON.stringify({ path, format: 'convex_encoded_json', args: [{ proof: 'fixture' }] }),
	});
afterEach(() => vi.unstubAllGlobals());

test('completed sign-in moves the refresh token to HttpOnly cookies and excludes it from JSON', async () => {
	const upstream = vi.fn(async () =>
		Response.json({
			status: 'success',
			value: {
				status: 'complete',
				tokens: {
					userId: 'alice',
					accessToken: 'access-fixture',
					refreshToken: 'refresh-secret-fixture',
					accessTokenExpiresAt: Date.now() + 60_000,
					refreshTokenExpiresAt: Date.now() + 86_400_000,
				},
			},
		})
	);
	vi.stubGlobal('fetch', upstream);
	const response = await routes.convexProxyHandler(call());
	expect(response.status).toBe(200);
	const body = await response.text();
	expect(body).toContain('access-fixture');
	expect(body).not.toContain('refresh-secret-fixture');
	expect(response.headers.getSetCookie()).toHaveLength(2);
	expect(
		response.headers
			.getSetCookie()
			.every((cookie) => cookie.includes('HttpOnly') && cookie.includes('Secure'))
	).toBe(true);
	expect(upstream).toHaveBeenCalledTimes(1);
});

test('unlisted functions and cross-origin sign-ins are refused before a backend call', async () => {
	const fetch = vi.fn();
	vi.stubGlobal('fetch', fetch);
	expect((await routes.convexProxyHandler(call('admin:deleteEverything'))).status).toBe(403);
	expect((await routes.convexProxyHandler(call(undefined, 'https://attacker.test'))).status).toBe(
		403
	);
	expect(fetch).not.toHaveBeenCalled();
});

test('cross-origin refresh and logout cannot mutate cookies or call the backend', async () => {
	const fetch = vi.fn();
	vi.stubGlobal('fetch', fetch);
	for (const handler of [routes.refreshHandler, routes.signOutHandler]) {
		const response = await handler(call(undefined, 'https://attacker.test'));
		expect(response.status).toBe(403);
		expect(response.headers.getSetCookie()).toEqual([]);
	}
	expect(fetch).not.toHaveBeenCalled();
});

test('a pending verification response needs its own endpoint, outside the sign-in proxy', async () => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () =>
			Response.json({
				status: 'success',
				value: { status: 'verificationRequired' },
			})
		)
	);
	const response = await routes.convexProxyHandler(call());
	expect(response.status).toBe(500);
	expect(response.headers.getSetCookie()).toEqual([]);
	expect(await response.text()).toContain('did not return a sign-in result');
});
