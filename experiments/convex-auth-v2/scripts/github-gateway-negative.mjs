import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(`${process.env.PROOF_PLAYWRIGHT}/index.mjs`).href);
const origin =
	process.env.PROOF_CLOUD === '1'
		? 'https://kino-auth-v2-proof-c318c09d.hello-fc8.workers.dev'
		: 'https://127.0.0.1:5183';
const gatewayCallback =
	process.env.PROOF_CLOUD === '1'
		? 'https://kino-v2-gateway-proof-c318c09d.hello-fc8.workers.dev/oauth/github/callback'
		: 'http://127.0.0.1:4411/oauth/github/callback';
const browser = await chromium.launch();
try {
	const context = await browser.newContext({ ignoreHTTPSErrors: process.env.PROOF_CLOUD !== '1' });
	const blocked = await context.request.post(origin + '/api/auth/github/start', {
		headers: { Origin: 'https://evil.test' },
	});
	assert.equal(blocked.status(), 403);
	const started = await context.request.post(origin + '/api/auth/github/start', {
		headers: { Origin: origin },
	});
	assert.equal(started.status(), 200);
	const flow = await started.json();
	const authorize = new URL(flow.redirect);
	assert.equal(authorize.origin, 'https://github.com');
	assert.equal(authorize.searchParams.get('redirect_uri'), gatewayCallback);
	assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
	const stateCookie = (await context.cookies()).find((c) => c.name === 'proofGithubState');
	assert.ok(stateCookie?.secure && stateCookie?.httpOnly);
	const denied = new URL(gatewayCallback);
	denied.searchParams.set('state', authorize.searchParams.get('state'));
	denied.searchParams.set('error', 'access_denied');
	const gateway = await context.request.get(denied.href, { maxRedirects: 0 });
	assert.equal(gateway.status(), 302);
	const returned = await context.request.get(gateway.headers().location, { maxRedirects: 0 });
	assert.equal(returned.status(), 303);
	assert.ok(returned.headers().location.includes('oauthError=access_denied'));
	assert.equal(
		(await context.cookies()).filter(
			(c) => c.name.includes('convexAuth') || c.name === 'proofGithubState'
		).length,
		0
	);
	assert.equal((await context.request.get(denied.href, { maxRedirects: 0 })).status(), 400);
	const missing = await context.request.get(
		origin + '/api/auth/github/callback?convexAuthCode=fake',
		{ maxRedirects: 0 }
	);
	assert.equal(missing.status(), 303);
	assert.ok(missing.headers().location.includes('invalid_flow'));
	console.log(
		'PASS: exact gateway callback, PKCE, Secure/HttpOnly state cookie, cross-origin start refusal, cancellation, callback replay rejection, and missing-state rejection on the selected Workers/Convex environment.'
	);
} finally {
	await browser.close();
}
