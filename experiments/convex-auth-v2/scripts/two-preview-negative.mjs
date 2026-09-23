import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

import { SignJWT } from 'jose';

const gateway =
	'https://kino-v2-gateway-proof-c318c09d.hello-fc8.workers.dev/oauth/github/callback';
const origins = [
	'https://kino-auth-v2-proof-c318c09d.hello-fc8.workers.dev',
	'https://kino-auth-v2-proof-beta-c318c09d.hello-fc8.workers.dev',
];
const starts = await Promise.all(
	origins.map(async (origin) => {
		const r = await fetch(origin + '/api/auth/github/start', {
			method: 'POST',
			headers: { Origin: origin },
		});
		assert.equal(r.status, 200);
		const j = await r.json();
		const u = new URL(j.redirect);
		assert.equal(u.searchParams.get('redirect_uri'), gateway);
		assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
		return u.searchParams.get('state');
	})
);
const callback = (state) => {
	const u = new URL(gateway);
	u.searchParams.set('state', state);
	u.searchParams.set('error', 'access_denied');
	return u;
};
assert.ok(starts.every((state) => /^[A-Za-z0-9_-]{43}$/.test(state)));
assert.equal((await fetch(callback('z'.repeat(43)), { redirect: 'manual' })).status, 400);
const registry = JSON.parse(
	JSON.parse(readFileSync(new URL('../cloud/.env.routes.local.json', import.meta.url))).PROOF_ROUTES
);
const nativeResponse = await fetch('https://graceful-elephant-103.convex.cloud/api/mutation', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		path: 'github:startSignInGithub',
		format: 'json',
		args: { redirectTo: origins[0] + '/api/auth/github/callback' },
	}),
});
const native = await nativeResponse.json();
assert.equal(native.status, 'success');
const nativeState = new URL(native.value.redirect).searchParams.get('state');
const wrongState = await new SignJWT({ state: nativeState })
	.setProtectedHeader({ alg: 'HS256', typ: 'JWT', kid: 'c318c09d-beta' })
	.setIssuer('c318c09d-beta')
	.setAudience('kino-convex-v2-github-gateway')
	.setIssuedAt()
	.setExpirationTime('10m')
	.sign(new TextEncoder().encode(registry['c318c09d-beta'].secret));
const registration = await fetch(new URL('/oauth/state', gateway), {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ envelope: wrongState }),
});
assert.equal(registration.status, 200);
const registered = await registration.json();
assert.equal((await fetch(callback(registered.state), { redirect: 'manual' })).status, 400);
await Promise.all(
	starts.map(async (state, i) => {
		const r = await fetch(callback(state), { redirect: 'manual' });
		assert.equal(r.status, 302);
		assert.equal(new URL(r.headers.get('location')).origin, origins[i]);
		assert.equal((await fetch(callback(state), { redirect: 'manual' })).status, 400);
	})
);
console.log(
	'PASS: concurrent cancellation routes correctly; unknown opaque references, cross-backend state under a valid other-preview signature, and callback replay are rejected.'
);
writeFileSync(
	new URL('../cloud/results-two-preview-negative.json', import.meta.url),
	JSON.stringify(
		{
			recordedAt: new Date().toISOString(),
			checks: [
				'both previews advertise one gateway, S256, and 43-character opaque state',
				'unknown opaque reference refused',
				'valid beta signature cannot claim alpha state',
				'concurrent cancellations return to correct apps',
				'both callback replays refused',
			],
		},
		null,
		2
	) + '\n'
);
