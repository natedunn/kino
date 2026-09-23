import { build } from 'esbuild';
import { SignJWT } from 'jose';
import { Miniflare } from 'miniflare';
import { Response as MockResponse } from 'undici';
import { afterAll, beforeAll, expect, test } from 'vitest';

import { REFERENCE_PATTERN } from '../gateway/opaque-state';
import { signRoute } from '../gateway/routing';

let mf: Miniflare;
const secret = 'a'.repeat(64);
const routes = {
	alpha: {
		backendCallback: 'https://alpha.convex.site/oauth/github/callback',
		appCallback: 'https://alpha.example/api/auth/github/callback',
		secret,
	},
	beta: {
		backendCallback: 'https://beta.convex.site/oauth/github/callback',
		appCallback: 'https://beta.example/api/auth/github/callback',
		secret: 'b'.repeat(64),
	},
};
let forwarded = 0;
beforeAll(async () => {
	const bundle = await build({
		entryPoints: ['gateway/cloud-entry.ts'],
		bundle: true,
		write: false,
		format: 'esm',
		platform: 'browser',
		external: ['cloudflare:workers'],
		conditions: ['workerd', 'browser'],
	});
	mf = new Miniflare({
		modules: true,
		script: bundle.outputFiles[0].text,
		compatibilityDate: '2026-05-22',
		durableObjects: { OAUTH_STATES: { className: 'OAuthState', useSQLite: true } },
		bindings: { PROOF_ROUTES: JSON.stringify(routes) },
		outboundService: async (request: { url: string }) => {
			const host = new URL(request.url).hostname;
			const id = host.split('.')[0];
			if (!['alpha', 'beta'].includes(id)) throw new Error('Unexpected outbound host');
			forwarded++;
			return new MockResponse(null, {
				status: 303,
				headers: {
					location: `https://${id}.example/api/auth/github/callback?convexAuthError=access_denied`,
				},
			});
		},
	});
});
afterAll(async () => {
	await mf?.dispose();
});
async function register(envelope: string) {
	return mf.dispatchFetch('https://gateway.example/oauth/state', {
		method: 'POST',
		body: JSON.stringify({ envelope }),
	});
}
async function mint(id: 'alpha' | 'beta' = 'alpha') {
	const response = await register(
		await signRoute(id, 'native-state-'.repeat(4), routes[id].secret)
	);
	expect(response.status).toBe(200);
	const body = (await response.json()) as { state: string };
	expect(body.state).toMatch(REFERENCE_PATTERN);
	return body.state;
}
const cancel = (state: string) =>
	mf.dispatchFetch(
		`https://gateway.example/oauth/github/callback?state=${state}&error=access_denied`,
		{ redirect: 'manual' }
	);
test('two previews resolve opaque references to their exact own callback', async () => {
	for (const id of ['alpha', 'beta'] as const) {
		const state = await mint(id);
		const r = await cancel(state);
		expect(r.status, await r.text()).toBe(303);
		expect(new URL(r.headers.get('location')!).hostname).toBe(`${id}.example`);
		expect((await cancel(state)).status).toBe(400);
	}
});
test('eight concurrent callbacks forward exactly once with real SQLite storage', async () => {
	const state = await mint();
	const before = forwarded;
	const responses = await Promise.all(Array.from({ length: 8 }, () => cancel(state)));
	expect(responses.filter((r) => r.status === 303)).toHaveLength(1);
	expect(responses.filter((r) => r.status === 400)).toHaveLength(7);
	expect(forwarded - before).toBe(1);
});
test('forged registration, signed envelopes used directly, unknown references rejected', async () => {
	expect(
		(await register(await signRoute('alpha', 'native-state-'.repeat(4), 'z'.repeat(64)))).status
	).toBe(400);
	expect((await cancel(await signRoute('alpha', 'native-state-'.repeat(4), secret))).status).toBe(
		400
	);
	expect((await cancel('z'.repeat(43))).status).toBe(400);
});
test('malformed callback does not consume a valid reference', async () => {
	const state = await mint();
	expect(
		(
			await mf.dispatchFetch(
				`https://gateway.example/oauth/github/callback?state=${state}&code=a&error=b`
			)
		).status
	).toBe(400);
	expect((await cancel(state)).status).toBe(303);
});
test('expired signed payload cannot be redeemed even while its object exists', async () => {
	const now = Math.floor(Date.now() / 1000);
	const envelope = await new SignJWT({ state: 'native-state-'.repeat(4) })
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT', kid: 'alpha' })
		.setIssuer('alpha')
		.setAudience('kino-convex-v2-github-gateway')
		.setIssuedAt(now)
		.setExpirationTime(now + 2)
		.sign(new TextEncoder().encode(secret));
	const r = await register(envelope);
	expect(r.status).toBe(200);
	const { state } = (await r.json()) as { state: string };
	await new Promise((r) => setTimeout(r, 2200));
	const before = forwarded;
	expect((await cancel(state)).status).toBe(400);
	expect(forwarded).toBe(before);
});
