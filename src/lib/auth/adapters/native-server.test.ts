import { describe, expect, test } from 'vitest';

import { handleNativeAuthRequest } from './native-server';

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
