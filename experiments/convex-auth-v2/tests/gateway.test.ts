import { expect, test, vi } from 'vitest';

import { callback } from '../gateway/worker';

const state = 's'.repeat(32);
test('gateway forwards to the fixed backend and accepts only the exact app callback', async () => {
	const send = vi.fn<typeof fetch>().mockResolvedValue(
		new Response(null, {
			status: 302,
			headers: {
				Location: 'https://127.0.0.1:5183/api/auth/github/callback?convexAuthCode=proof',
			},
		})
	);
	const result = await callback(
		new Request(
			`http://gateway/oauth/github/callback?state=${state}&code=example&target=https://evil.test`
		),
		send
	);
	expect(result.status).toBe(302);
	const target = new URL(String(send.mock.calls[0][0]));
	expect(target.origin).toBe('http://127.0.0.1:4421');
	expect(target.searchParams.has('target')).toBe(false);
	expect(send.mock.calls[0][1]?.redirect).toBe('manual');
	expect(result.headers.get('referrer-policy')).toBe('no-referrer');
});
test('gateway rejects untrusted upstream redirects', async () => {
	const send = vi
		.fn<typeof fetch>()
		.mockResolvedValue(
			new Response(null, { status: 302, headers: { Location: 'https://evil.test/callback' } })
		);
	expect(
		(
			await callback(
				new Request(`http://gateway/oauth/github/callback?state=${state}&code=example`),
				send
			)
		).status
	).toBe(502);
});
test('malformed, duplicate and ambiguous callbacks never reach a backend', async () => {
	const send = vi.fn<typeof fetch>();
	for (const params of [
		'code=example',
		`state=${state}&code=a&code=b`,
		`state=${state}&code=a&error=denied`,
	])
		expect(
			(await callback(new Request('http://gateway/oauth/github/callback?' + params), send)).status
		).toBe(400);
	expect(send).not.toHaveBeenCalled();
});
