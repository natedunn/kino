import type { GatewayEnv } from './env';

import { describe, expect, it } from 'vitest';

import { rewriteProxyCallbackRedirect } from './redirect-rewrite';

const env = {
	TRUSTED_TARGET_PATTERNS:
		'https://*-kino.hello-fc8.workers.dev,https://*.kino.localhost:*,https://*.convex.site',
} as GatewayEnv;

const previewOrigin = 'https://natedunn-convex-preview-oauth-webhooks-kino.hello-fc8.workers.dev';

function redirect(location: string) {
	return new Response(null, { headers: { location }, status: 302 });
}

describe('rewriteProxyCallbackRedirect', () => {
	it('rewrites a convex.site oauth-proxy-callback to the app origin', () => {
		const callbackURL = encodeURIComponent(`${previewOrigin}/auth`);
		const result = rewriteProxyCallbackRedirect(
			env,
			redirect(
				`https://agile-ibex-133.convex.site/api/auth/oauth-proxy-callback?callbackURL=${callbackURL}&profile=abc`
			)
		);

		const location = result.headers.get('location')!;
		const url = new URL(location);
		expect(url.origin).toBe(previewOrigin);
		expect(url.pathname).toBe('/api/auth/oauth-proxy-callback');
		expect(url.searchParams.get('profile')).toBe('abc');
		expect(url.searchParams.get('callbackURL')).toBe(`${previewOrigin}/auth`);
	});

	it('refuses untrusted app origins', () => {
		const callbackURL = encodeURIComponent('https://evil.example.com/auth');
		const location = `https://agile-ibex-133.convex.site/api/auth/oauth-proxy-callback?callbackURL=${callbackURL}&profile=abc`;
		const result = rewriteProxyCallbackRedirect(env, redirect(location));
		expect(result.headers.get('location')).toBe(location);
	});

	it('leaves non-proxy-callback redirects alone', () => {
		const location = 'https://github.com/login/oauth/authorize?x=1';
		const result = rewriteProxyCallbackRedirect(env, redirect(location));
		expect(result.headers.get('location')).toBe(location);
	});

	it('leaves non-redirect responses alone', () => {
		const ok = new Response('hi', { status: 200 });
		expect(rewriteProxyCallbackRedirect(env, ok)).toBe(ok);
	});
});
