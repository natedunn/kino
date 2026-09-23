import { describe, expect, test } from 'vitest';

import { completeNativeGithub, nativeGithubTestHelpers } from './native-github-server';

describe('native GitHub return targets', () => {
	test('keeps same-origin paths, query strings and fragments', () => {
		expect(
			nativeGithubTestHelpers.safeReturnPath(
				'https://kino.example/dashboard?from=github#ready',
				'https://kino.example'
			)
		).toBe('/dashboard?from=github#ready');
	});

	test.each([
		'https://evil.example/dashboard',
		'https://user:password@kino.example/dashboard',
		'http://[::1',
		undefined,
	])('falls back for an unsafe return target', (target) => {
		expect(nativeGithubTestHelpers.safeReturnPath(target, 'https://kino.example')).toBe(
			'/dashboard'
		);
	});
});

describe('native GitHub route IDs', () => {
	test('derives a stable preview route ID from the exact request origin', async () => {
		expect(
			await nativeGithubTestHelpers.resolveRouteId('https://abc-kino.hello-fc8.workers.dev')
		).toBe('preview-5645ab3ffbaf11875e4b9fab0ad8b009c4f5da06');
		expect(await nativeGithubTestHelpers.resolveRouteId('https://abc.example')).toBe(
			'preview-a802f9321394cc72a90122c4606d2e7af6c01da8'
		);
	});

	test('keeps an explicit production or local proof route ID', async () => {
		expect(
			await nativeGithubTestHelpers.resolveRouteId(
				'https://abc-kino.hello-fc8.workers.dev',
				'kino-production'
			)
		).toBe('kino-production');
	});
});

describe('native GitHub callback failures', () => {
	test('rejects malformed cookie encoding without throwing', async () => {
		const response = await completeNativeGithub(
			new Request('https://kino.example/api/auth/github/callback?convexAuthCode=code', {
				headers: { Cookie: 'kinoNativeGithubState=%E0%A4%A' },
			}),
			async () => new Response('unused')
		);
		expect(response.status).toBe(303);
		expect(response.headers.get('location')).toBe(
			'https://kino.example/auth?oauthError=invalid_flow'
		);
	});

	test('rejects a non-JSON auth proxy failure without throwing', async () => {
		const response = await completeNativeGithub(
			new Request('https://kino.example/api/auth/github/callback?convexAuthCode=code', {
				headers: { Cookie: 'kinoNativeGithubState=state' },
			}),
			async () => new Response('upstream failure', { status: 502 })
		);
		expect(response.status).toBe(303);
		expect(response.headers.get('location')).toBe(
			'https://kino.example/auth?oauthError=invalid_flow'
		);
	});
});
