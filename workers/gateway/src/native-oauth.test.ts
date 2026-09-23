import type { GatewayEnv } from './env';
import type { Routes } from './native-routing';

import { describe, expect, it, vi } from 'vitest';

import worker from './index';
import stage from './stage';
import { handleNativeOAuth } from './native-oauth';
import { parseNativeRoutes, signRoute } from './native-routing';

const routes: Routes = {
	alpha: {
		backendCallback: 'https://alpha.convex.site/oauth/github/callback',
		appCallback: 'https://alpha.example/api/auth/github/callback',
		secret: 'a'.repeat(64),
	},
	beta: {
		backendCallback: 'https://beta.convex.site/oauth/github/callback',
		appCallback: 'https://beta.example/api/auth/github/callback',
		secret: 'b'.repeat(64),
	},
};

function fixtureEnv() {
	const records = new Map<string, string>();
	const store = {
		idFromName: (name: string) => name,
		get: (name: string) => ({
			create: async (envelope: string) => {
				if (records.has(name)) return false;
				records.set(name, envelope);
				return true;
			},
			consume: async () => {
				const envelope = records.get(name) ?? null;
				records.delete(name);
				return envelope;
			},
		}),
	};
	return { ...({} as GatewayEnv), OAUTH_STATES: store as unknown as GatewayEnv['OAUTH_STATES'] };
}
const ctx = {} as ExecutionContext;
const base = 'https://gateway.example/oauth/github/callback';

async function register(env: GatewayEnv, route = 'alpha') {
	const envelope = await signRoute(route, 'original-provider-state-value-123', routes[route].secret);
	const response = await handleNativeOAuth(
		new Request('https://gateway.example/oauth/state', {
			method: 'POST',
			body: JSON.stringify({ envelope }),
		}), env, routes
	);
	expect(response.status).toBe(200);
	const body = await response.json() as { state: string };
	expect(body.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
	return body.state;
}

describe('native OAuth gateway', () => {
	it('stages storage while leaving native routes closed, with no secrets in health', async () => {
		const env = { ...fixtureEnv(), NATIVE_GITHUB_ROUTES: JSON.stringify(routes) };
		const staged = await stage.fetch(new Request('https://gateway.example/health'), env, ctx);
		const stageHealth = await staged.json() as { nativeGithub: { enabled: boolean; storage: boolean } };
		expect(stageHealth.nativeGithub).toMatchObject({ storage: true, enabled: false });
		expect(JSON.stringify(stageHealth)).not.toContain(routes.alpha.secret);
		expect((await stage.fetch(new Request(base), env, ctx)).status).toBe(404);
		const active = await worker.fetch(new Request('https://gateway.example/health'), env, ctx);
		expect((await active.json() as { nativeGithub: { enabled: boolean } }).nativeGithub.enabled).toBe(true);
		expect((await worker.fetch(new Request(base), fixtureEnv(), ctx)).status).toBe(503);
	});

	it('requires an exact validated route registry', () => {
		expect(parseNativeRoutes(undefined)).toBeNull();
		expect(parseNativeRoutes('{}')).toBeNull();
		expect(parseNativeRoutes(JSON.stringify({ alpha: { ...routes.alpha, backendCallback: 'http://evil.test/oauth/github/callback' } }))).toBeNull();
		expect(parseNativeRoutes(JSON.stringify(routes))).toEqual(routes);
	});

	it('forwards one opaque callback to its exact backend and refuses replay', async () => {
		const env = fixtureEnv();
		const reference = await register(env);
		const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, {
			status: 302,
			headers: { Location: routes.alpha.appCallback + '?convexAuthCode=ticket' },
		}));
		const request = new Request(`${base}?state=${reference}&code=provider-code&target=https://evil.test`);
		const response = await handleNativeOAuth(request, env, routes, send);
		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toContain('alpha.example');
		expect(response.headers.get('referrer-policy')).toBe('no-referrer');
		expect(String(send.mock.calls[0][0])).toBe(routes.alpha.backendCallback + '?code=provider-code&state=original-provider-state-value-123');
		expect(new Headers(send.mock.calls[0][1]?.headers).has('cookie')).toBe(false);
		expect((await handleNativeOAuth(request, env, routes, send)).status).toBe(400);
		expect(send).toHaveBeenCalledTimes(1);
	});

	it('rejects cross-preview redirect, malformed callback, and unknown state before forwarding', async () => {
		const env = fixtureEnv();
		const reference = await register(env);
		const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, {
			status: 302,
			headers: { Location: routes.beta.appCallback + '?convexAuthCode=ticket' },
		}));
		expect((await handleNativeOAuth(new Request(`${base}?state=${reference}&code=a&code=b`), env, routes, send)).status).toBe(400);
		// Malformed input does not consume a legitimate reference.
		expect((await handleNativeOAuth(new Request(`${base}?state=${reference}&code=provider-code`), env, routes, send)).status).toBe(502);
		expect((await handleNativeOAuth(new Request(`${base}?state=${'x'.repeat(43)}&code=a`), env, routes, send)).status).toBe(400);
		expect(send).toHaveBeenCalledTimes(1);
	});

	it('rejects a signed state from an unknown or mismatched preview', async () => {
		const env = fixtureEnv();
		for (const [id, secret] of [['unknown', routes.alpha.secret], ['alpha', routes.beta.secret]]) {
			const envelope = await signRoute(id, 'original-provider-state-value-123', secret);
			const response = await handleNativeOAuth(new Request('https://gateway.example/oauth/state', {
				method: 'POST', body: JSON.stringify({ envelope }),
			}), env, routes);
			expect(response.status).toBe(400);
		}
	});
});
