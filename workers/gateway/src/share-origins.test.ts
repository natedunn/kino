import type { GatewayEnv } from './env';

import { describe, expect, it } from 'vitest';

import { isTrustedTargetOrigin, normalizeQuickTunnelOrigin } from './env';
import { verifyGitHubAppState } from './github-relay';
import { handleTargetsApi } from './hooks';
import { rewriteProxyCallbackRedirect } from './redirect-rewrite';
import { handleShareOriginsApi } from './share-origins';

function createKv() {
	const values = new Map<string, string>();
	const putOptions: Array<KVNamespacePutOptions | undefined> = [];
	return Object.assign(
		{
			delete: async (key: string) => void values.delete(key),
			get: async (key: string, type?: string) => {
				const value = values.get(key) ?? null;
				return type === 'json' && value ? JSON.parse(value) : value;
			},
			put: async (key: string, value: string, options?: KVNamespacePutOptions) => {
				putOptions.push(options);
				values.set(key, value);
			},
		} as unknown as KVNamespace,
		{ putOptions }
	);
}

function env(overrides: Partial<GatewayEnv> = {}) {
	return {
		GATEWAY_ADMIN_TOKEN: 'admin-secret',
		GITHUB_RELAY_STATE_SECRET: 'relay-state-secret',
		QUICK_TUNNEL_TARGETS_ENABLED: 'true',
		TARGETS: createKv(),
		TRUSTED_TARGET_PATTERNS: 'https://usekino.com',
		...overrides,
	} as GatewayEnv;
}

async function signedRelayState(targetUrl: string) {
	const payload = JSON.stringify({
		exp: Date.now() + 60_000,
		nonce: 'nonce',
		targetUrl,
		v: 1,
	});
	const bytes = new TextEncoder().encode(payload);
	const encoded = btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode('relay-state-secret'),
		{ hash: 'SHA-256', name: 'HMAC' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded));
	const hex = Array.from(new Uint8Array(signature))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
	return `${encoded}.${hex}`;
}

function request(method: string, origin: string, token = 'admin-secret') {
	return new Request('https://gateway-dev.usekino.com/dev/share-origins', {
		body: JSON.stringify({ origin }),
		headers: {
			authorization: `Bearer ${token}`,
			'content-type': 'application/json',
		},
		method,
	});
}

describe('temporary share origins', () => {
	it('registers and removes an exact Quick Tunnel origin', async () => {
		const kv = createKv();
		const testEnv = env({ TARGETS: kv });
		const origin = 'https://quiet-bird-123.trycloudflare.com';

		expect(await isTrustedTargetOrigin(testEnv, origin)).toBe(false);
		expect((await handleShareOriginsApi(testEnv, request('PUT', origin))).status).toBe(200);
		expect(kv.putOptions.at(-1)?.expirationTtl).toBe(60 * 60 * 6);
		expect(await isTrustedTargetOrigin(testEnv, origin)).toBe(true);
		expect(await isTrustedTargetOrigin(testEnv, 'https://other.trycloudflare.com')).toBe(false);

		expect((await handleShareOriginsApi(testEnv, request('DELETE', origin))).status).toBe(200);
		expect(await isTrustedTargetOrigin(testEnv, origin)).toBe(false);
	});

	it('requires the dev-only flag and admin token', async () => {
		const origin = 'https://quiet-bird-123.trycloudflare.com';
		expect(
			(
				await handleShareOriginsApi(
					env({ QUICK_TUNNEL_TARGETS_ENABLED: undefined }),
					request('PUT', origin)
				)
			).status
		).toBe(404);
		expect((await handleShareOriginsApi(env(), request('PUT', origin, 'wrong'))).status).toBe(401);
	});

	it('reports support without creating a registration', async () => {
		const response = await handleShareOriginsApi(
			env(),
			new Request('https://gateway-dev.usekino.com/dev/share-origins', {
				headers: { authorization: 'Bearer admin-secret' },
			})
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ enabled: true });
	});

	it('uses exact registrations for auth redirects, Relay callbacks, and webhook targets', async () => {
		const testEnv = env();
		const appOrigin = 'https://quiet-bird-123.trycloudflare.com';
		const siteOrigin = 'https://convex-site-123.trycloudflare.com';
		await handleShareOriginsApi(testEnv, request('PUT', appOrigin));
		await handleShareOriginsApi(testEnv, request('PUT', siteOrigin));

		const callbackURL = encodeURIComponent(`${appOrigin}/auth`);
		const redirect = new Response(null, {
			headers: {
				location: `https://local.convex.site/api/auth/oauth-proxy-callback?callbackURL=${callbackURL}`,
			},
			status: 302,
		});
		expect(
			(await rewriteProxyCallbackRedirect(testEnv, redirect)).headers.get('location')
		).toContain(`${appOrigin}/api/auth/oauth-proxy-callback`);

		const relay = await verifyGitHubAppState(
			testEnv,
			await signedRelayState(`${appOrigin}/api/github/callback`)
		);
		expect(relay.targetUrl).toBe(`${appOrigin}/api/github/callback`);

		const targetResponse = await handleTargetsApi(
			testEnv,
			new Request('https://gateway-dev.usekino.com/hooks/targets', {
				body: JSON.stringify({ url: `${siteOrigin}/api/github/webhook` }),
				headers: {
					authorization: 'Bearer admin-secret',
					'content-type': 'application/json',
				},
				method: 'PUT',
			})
		);
		expect(targetResponse.status).toBe(200);
	});

	it('accepts only origin-only HTTPS Quick Tunnel URLs', () => {
		expect(normalizeQuickTunnelOrigin('https://quiet-bird-123.trycloudflare.com')).toBe(
			'https://quiet-bird-123.trycloudflare.com'
		);
		for (const value of [
			'http://quiet-bird-123.trycloudflare.com',
			'https://quiet-bird-123.trycloudflare.com/path',
			'https://quiet-bird-123.trycloudflare.com?x=1',
			'https://quiet-bird-123.trycloudflare.com.evil.test',
			'https://nested.quiet-bird-123.trycloudflare.com',
			'https://user@quiet-bird-123.trycloudflare.com',
			'https://quiet-bird-123.trycloudflare.com:8443',
		]) {
			expect(normalizeQuickTunnelOrigin(value)).toBeNull();
		}
	});
});
