import { describe, expect, it, test } from 'vitest';

import { handleNativeAuthRequest, withPublicDevUrl } from './native-server';

describe('native Start auth routes', () => {
	test('does not expose auth handlers over GET', async () => {
		const response = await handleNativeAuthRequest(
			new Request('http://127.0.0.1:5190/api/auth/refresh')
		);
		expect(response.status).toBe(404);
	});

	test('rejects a GitHub callback without its HttpOnly browser state', async () => {
		const response = await handleNativeAuthRequest(
			new Request('http://127.0.0.1:5190/api/auth/github/callback?convexAuthCode=fake')
		);
		expect(response.status).toBe(303);
		expect(response.headers.get('location')).toBe(
			'http://127.0.0.1:5190/auth?oauthError=invalid_flow'
		);
		expect(response.headers.getSetCookie()).toHaveLength(2);
	});

	test.each(['/api/auth/signin?path=/api/mutation', '/api/auth/refresh', '/api/auth/signout'])(
		'rejects cross-origin POST requests to %s',
		async (path) => {
			const response = await handleNativeAuthRequest(
				new Request(`http://127.0.0.1:5190${path}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
					body: '{}',
				})
			);
			expect(response.status).toBe(403);
			expect(response.headers.get('cache-control')).toBe('private, no-store');
		}
	);
});

describe('withPublicDevUrl', () => {
	const forwarded = {
		'x-forwarded-host': 't3code-015108e7.kino.localhost:1355',
		'x-forwarded-proto': 'https',
	};

	it('restores the Portless origin for dev requests proxied to a loopback port', async () => {
		const request = new Request('https://127.0.0.1:4655/api/auth/github/start?x=1', {
			method: 'POST',
			headers: forwarded,
			body: '{"callbackURL":"/dashboard"}',
		});
		const result = withPublicDevUrl(request, true);
		expect(result.url).toBe(
			'https://t3code-015108e7.kino.localhost:1355/api/auth/github/start?x=1'
		);
		expect(result.method).toBe('POST');
		expect(await result.text()).toBe('{"callbackURL":"/dashboard"}');
	});

	it('never trusts forwarded headers outside dev, off loopback, or for non-localhost hosts', () => {
		const loopback = 'https://127.0.0.1:4655/api/auth/signin';
		const cases: Array<[string, Record<string, string>, boolean]> = [
			[loopback, forwarded, false],
			['https://usekino.com/api/auth/signin', forwarded, true],
			[loopback, { ...forwarded, 'x-forwarded-host': 'evil.example.com' }, true],
			[loopback, { ...forwarded, 'x-forwarded-host': 'a.localhost/@evil.example.com' }, true],
			[loopback, { ...forwarded, 'x-forwarded-proto': 'javascript' }, true],
			[loopback, { 'x-forwarded-proto': 'https' }, true],
		];
		for (const [url, headers, isDev] of cases) {
			const request = new Request(url, { headers });
			expect(withPublicDevUrl(request, isDev)).toBe(request);
		}
	});
});
