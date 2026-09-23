import type { Routes } from '../gateway/routing';

import { SignJWT } from 'jose';
import { expect, test, vi } from 'vitest';

import preview from '../gateway/preview-worker';
import { resolveRoute, signRoute } from '../gateway/routing';
import { callback } from '../gateway/worker';

const state = 'upstream-state-'.repeat(3);
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
const request = (token: string) =>
	new Request(`https://gateway.example/oauth/github/callback?state=${token}&code=provider-code`);
for (const id of ['alpha', 'beta'])
	test(`routes ${id} with original state and no browser cookies`, async () => {
		const token = await signRoute(id, state, routes[id].secret);
		const send = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(null, {
				status: 302,
				headers: { Location: routes[id].appCallback + '?convexAuthCode=ticket' },
			})
		);
		const req = request(token);
		req.headers.set('Cookie', 'private=value');
		expect((await callback(req, send, routes)).status).toBe(302);
		const [url, init] = send.mock.calls[0];
		expect(String(url)).toBe(
			routes[id].backendCallback + '?state=' + state + '&code=provider-code'
		);
		expect(new Headers(init?.headers).has('cookie')).toBe(false);
	});
test('tampering, unknown routes, another preview key, expired and future tokens never forward', async () => {
	const now = Math.floor(Date.now() / 1000);
	const valid = await signRoute('alpha', state, routes.alpha.secret);
	const send = vi.fn<typeof fetch>();
	for (const token of [
		valid.slice(0, -8) + 'tampered',
		await signRoute('missing', state, routes.alpha.secret),
		await signRoute('alpha', state, routes.beta.secret),
		await signRoute('alpha', state, routes.alpha.secret, now - 601),
		await signRoute('alpha', state, routes.alpha.secret, now + 60),
		state,
	])
		expect((await callback(request(token), send, routes)).status).toBe(400);
	expect(send).not.toHaveBeenCalled();
});
test('rejects removed targets and rotated keys', async () => {
	const token = await signRoute('alpha', state, routes.alpha.secret);
	await expect(resolveRoute(token, { beta: routes.beta })).rejects.toThrow();
	await expect(
		resolveRoute(token, { alpha: { ...routes.alpha, secret: 'c'.repeat(64) } })
	).rejects.toThrow();
});
test('alpha cannot redirect to beta', async () => {
	const send = vi
		.fn<typeof fetch>()
		.mockResolvedValue(
			new Response(null, { status: 302, headers: { Location: routes.beta.appCallback } })
		);
	expect(
		(await callback(request(await signRoute('alpha', state, routes.alpha.secret)), send, routes))
			.status
	).toBe(502);
});
test('rejects unsafe registry URLs', async () => {
	const token = await signRoute('alpha', state, routes.alpha.secret);
	for (const backendCallback of [
		'http://127.0.0.1/oauth/github/callback',
		'https://user:pass@alpha.convex.site/oauth/github/callback',
		'https://alpha.convex.site/elsewhere',
		'https://alpha.convex.site/oauth/github/callback?target=evil',
	])
		await expect(
			resolveRoute(token, { alpha: { ...routes.alpha, backendCallback } })
		).rejects.toThrow();
});
test('rejects oversized validity windows even with correct key', async () => {
	const now = Math.floor(Date.now() / 1000);
	const token = await new SignJWT({ state })
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT', kid: 'alpha' })
		.setIssuer('alpha')
		.setAudience('kino-convex-v2-github-gateway')
		.setIssuedAt(now)
		.setExpirationTime(now + 3600)
		.sign(new TextEncoder().encode(routes.alpha.secret));
	await expect(resolveRoute(token, routes)).rejects.toThrow();
});
test('network failures and malformed redirects return generic errors', async () => {
	const token = await signRoute('alpha', state, routes.alpha.secret);
	for (const send of [
		vi.fn<typeof fetch>().mockRejectedValue(new Error('sensitive exchange detail')),
		vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response(null, { status: 302, headers: { Location: 'not-a-url' } })),
	]) {
		const result = await callback(request(token), send, routes);
		expect(result.status).toBe(502);
		expect(await result.text()).not.toContain('sensitive');
	}
});
test('deployed entrypoint never falls back to local', async () => {
	expect((await preview.fetch(request(state), {})).status).toBe(503);
	expect((await preview.fetch(request(state), { PROOF_ROUTES: '{}' })).status).toBe(503);
});
