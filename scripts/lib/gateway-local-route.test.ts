import { describe, expect, it } from 'vitest';

import { localRouteId, newRouteSecret, rewriteManagedEnv } from './gateway-local-route.mjs';

describe('local gateway route helpers', () => {
	it('derives a stable, distinct route ID per app origin', () => {
		const a = localRouteId('https://kino.localhost:1355');
		expect(a).toMatch(/^local-[0-9a-f]{40}$/);
		expect(localRouteId('https://kino.localhost:1355')).toBe(a);
		expect(localRouteId('https://feature.kino.localhost:1355')).not.toBe(a);
	});

	it('generates a fresh route key every time', () => {
		const first = newRouteSecret();
		expect(first).toMatch(/^[0-9a-f]{64}$/);
		expect(newRouteSecret()).not.toBe(first);
	});

	it('replaces only the managed keys in .env.local', () => {
		const copied = [
			'GATEWAY_URL=https://gateway-dev.usekino.com',
			'NATIVE_GITHUB_ROUTE_ID=local-main',
			'NATIVE_GITHUB_ROUTE_SECRET=main-checkout-secret',
			'# comment',
			'VITE_NATIVE_GITHUB_ENABLED=true',
			'',
			'',
		].join('\n');
		expect(
			rewriteManagedEnv(copied, {
				NATIVE_GITHUB_GATEWAY_URL: 'https://gateway-dev.usekino.com/oauth/github/callback',
				NATIVE_GITHUB_ROUTE_ID: 'local-worktree',
				NATIVE_GITHUB_ROUTE_SECRET: 'fresh',
				VITE_NATIVE_GITHUB_ENABLED: 'true',
			})
		).toBe(
			[
				'GATEWAY_URL=https://gateway-dev.usekino.com',
				'# comment',
				'NATIVE_GITHUB_GATEWAY_URL=https://gateway-dev.usekino.com/oauth/github/callback',
				'NATIVE_GITHUB_ROUTE_ID=local-worktree',
				'NATIVE_GITHUB_ROUTE_SECRET=fresh',
				'VITE_NATIVE_GITHUB_ENABLED=true',
				'',
			].join('\n')
		);
	});

	it('writes only provided keys into an empty file', () => {
		expect(rewriteManagedEnv('', { VITE_NATIVE_GITHUB_ENABLED: 'false' })).toBe(
			'VITE_NATIVE_GITHUB_ENABLED=false\n'
		);
	});
});
