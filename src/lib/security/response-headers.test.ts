import { describe, expect, it } from 'vitest';

import { withSecurityHeaders } from './response-headers';

describe('withSecurityHeaders', () => {
	it('hardens HTTPS responses while preserving status, body and cookies', async () => {
		const response = new Response('redirecting', {
			status: 307,
			headers: [
				['Location', '/dashboard'],
				['Set-Cookie', 'first=one; HttpOnly; Secure'],
				['Set-Cookie', 'second=two; HttpOnly; Secure'],
			],
		});

		const secured = withSecurityHeaders(new Request('https://usekino.com/auth'), response);

		expect(secured.status).toBe(307);
		expect(secured.headers.get('location')).toBe('/dashboard');
		expect(secured.headers.getSetCookie()).toHaveLength(2);
		expect(await secured.text()).toBe('redirecting');
		expect(secured.headers.get('strict-transport-security')).toBe(
			'max-age=31536000; includeSubDomains'
		);
		expect(secured.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
		expect(secured.headers.get('content-security-policy')).toContain(
			"connect-src 'self' https: wss:"
		);
		expect(secured.headers.get('permissions-policy')).toContain('camera=()');
		expect(secured.headers.get('x-content-type-options')).toBe('nosniff');
		expect(secured.headers.get('x-frame-options')).toBe('DENY');
		expect(secured.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
	});

	it('preserves stricter route policy and omits HSTS on HTTP development responses', () => {
		const response = new Response(null, { headers: { 'Referrer-Policy': 'no-referrer' } });
		const secured = withSecurityHeaders(new Request('http://127.0.0.1:5173/auth'), response);

		expect(secured.headers.get('referrer-policy')).toBe('no-referrer');
		expect(secured.headers.has('strict-transport-security')).toBe(false);
	});
});
