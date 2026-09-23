import type { TokenBundle } from '@proof/auth-server';

import { AUTH_JWT_COOKIE, AUTH_REFRESH_COOKIE } from '@proof/auth-server';
import { describe, expect, test, vi } from 'vitest';

import { createRequestAuth } from '../src/request-auth';

// Unsigned fixtures only exercise expiry/cookie plumbing. Convex JWT verification
// is deliberately NOT simulated by decoding these values.
const token = (subject: string, seconds = 120) =>
	`e30.${Buffer.from(JSON.stringify({ sub: subject, exp: Math.floor(Date.now() / 1000) + seconds })).toString('base64url')}.fixture`;
const bundle = (userId: string): TokenBundle => ({
	userId,
	accessToken: token(userId),
	accessTokenExpiresAt: Date.now() + 120_000,
	refreshToken: `rotated-${userId}`,
	refreshTokenExpiresAt: Date.now() + 86_400_000,
});
const request = (cookie = '') => new Request('https://kino.test/project', { headers: { cookie } });

describe('request-scoped SSR auth candidate', () => {
	test('anonymous SSR makes no refresh call', async () => {
		const refresh = vi.fn();
		const auth = createRequestAuth(request(), refresh);
		expect(await auth.getToken()).toBeNull();
		expect(refresh).not.toHaveBeenCalled();
		expect(auth.finish(new Response('public')).headers.getSetCookie()).toEqual([]);
	});

	test('a fresh access cookie makes no refresh call', async () => {
		const access = token('alice');
		const refresh = vi.fn();
		const auth = createRequestAuth(request(`${AUTH_JWT_COOKIE}=${access}`), refresh);
		expect(await auth.getToken()).toBe(access);
		expect(refresh).not.toHaveBeenCalled();
	});

	test('parallel loaders share one refresh and cookies reach the streamed response', async () => {
		const tokens = bundle('alice');
		const refresh = vi.fn(async () => ({ kind: 'rotated' as const, tokens }));
		const auth = createRequestAuth(request(`${AUTH_REFRESH_COOKIE}=old`), refresh);
		expect(await Promise.all([auth.getToken(), auth.getToken(), auth.getToken()])).toEqual([
			tokens.accessToken,
			tokens.accessToken,
			tokens.accessToken,
		]);
		expect(refresh).toHaveBeenCalledTimes(1);
		expect(refresh).toHaveBeenCalledWith('old');
		const response = auth.finish(
			new Response('SSR content', { headers: { 'X-Proof': 'preserved' } })
		);
		expect(await response.text()).toBe('SSR content');
		expect(response.headers.get('X-Proof')).toBe('preserved');
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
		const cookies = response.headers.getSetCookie();
		expect(cookies).toHaveLength(2);
		for (const cookie of cookies) {
			expect(cookie).toContain('HttpOnly');
			expect(cookie).toContain('Secure');
		}
	});

	test('a reused refresh result cannot overwrite the winning refresh cookie', async () => {
		const { refreshToken: _, ...reused } = bundle('alice');
		const auth = createRequestAuth(request(`${AUTH_REFRESH_COOKIE}=old`), async () => ({
			kind: 'reused',
			...reused,
		}));
		await auth.getToken();
		const cookies = auth.finish(new Response()).headers.getSetCookie();
		expect(cookies).toHaveLength(1);
		expect(cookies[0]).toMatch(new RegExp(`^${AUTH_JWT_COOKIE}=`));
		expect(cookies.some((cookie) => cookie.startsWith(`${AUTH_REFRESH_COOKIE}=`))).toBe(false);
	});

	test('simultaneous SSR requests do not share tokens or cookie state', async () => {
		const alice = bundle('alice');
		const bob = bundle('bob');
		const a = createRequestAuth(request(`${AUTH_REFRESH_COOKIE}=alice`), async () => ({
			kind: 'rotated',
			tokens: alice,
		}));
		const b = createRequestAuth(request(`${AUTH_REFRESH_COOKIE}=bob`), async () => ({
			kind: 'rotated',
			tokens: bob,
		}));
		expect(await Promise.all([a.getToken(), b.getToken()])).toEqual([
			alice.accessToken,
			bob.accessToken,
		]);
		expect(a.finish(new Response()).headers.get('set-cookie')).not.toContain('rotated-bob');
		expect(b.finish(new Response()).headers.get('set-cookie')).not.toContain('rotated-alice');
	});

	test('a rejected session clears cookies; transport failure remains an error', async () => {
		const auth = createRequestAuth(request(`${AUTH_REFRESH_COOKIE}=revoked`), async () => ({
			kind: 'noSession',
		}));
		expect(await auth.getToken()).toBeNull();
		const cleared = auth.finish(new Response()).headers.getSetCookie();
		expect(cleared).toHaveLength(2);
		expect(cleared.every((cookie) => cookie.includes('Max-Age=0'))).toBe(true);
		const failed = createRequestAuth(request(`${AUTH_REFRESH_COOKIE}=valid`), async () => {
			throw new Error('unavailable');
		});
		await expect(failed.getToken()).rejects.toThrow('unavailable');
		expect(failed.finish(new Response()).headers.getSetCookie()).toEqual([]);
	});
});
