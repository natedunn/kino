// Writes disposable fixtures only to the dedicated loopback integration backend.
// Never accepts a target URL or key from the shell, and never prints tokens.
import assert from 'node:assert/strict';
import { randomUUID, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

const directory = new URL('../integrations/native-convex/', import.meta.url);
const settings = parseEnv(await readFile(new URL('.env.local', directory), 'utf8'));
const secrets = parseEnv(await readFile(new URL('.env.auth.local', directory), 'utf8'));
const local = JSON.parse(
	await readFile(new URL('.convex/local/default/config.json', directory), 'utf8')
);
assert.equal(settings.CONVEX_DEPLOYMENT, `anonymous:${local.deploymentName}`);
const cloud = `http://127.0.0.1:${local.ports.cloud}`;
const site = `http://127.0.0.1:${local.ports.site}`;
assert.equal(settings.CONVEX_URL, cloud);
assert.equal(settings.CONVEX_SITE_URL, site);
assert.equal(local.ports.cloud, 4440, 'Smoke fixtures require the isolated port 4440 backend');
assert.equal(local.ports.site, 4441);
console.log(`target: local-anonymous (${cloud}, dedicated native integration)`);

const admin = new ConvexHttpClient(cloud, { logger: false });
admin.setAdminAuth(local.adminKey);
const anonymous = new ConvexHttpClient(cloud, { logger: false });
const me = makeFunctionReference('profiles:me');
const authenticated = makeFunctionReference('auth:isAuthenticated');
assert.equal(await anonymous.query(me, {}), null);
assert.equal(await anonymous.query(authenticated, {}), false);

const jwksResponse = await fetch(`${site}/auth/.well-known/jwks.json`);
assert.equal(jwksResponse.status, 200);
const jwks = await jwksResponse.json();
assert.deepEqual(
	jwks,
	JSON.parse(secrets.AUTH_JWKS),
	'Mounted core must serve the configured JWKS'
);

const fixture = randomUUID();
const userId = await admin.mutation(makeFunctionReference('github:createUser'), {
	provider: {
		name: 'github',
		accountId: `local-smoke-${fixture}`,
		profile: {
			id: `local-smoke-${fixture}`,
			login: 'native-smoke',
			name: 'Native integration smoke',
			email: `${fixture}@example.test`,
			emailVerified: true,
		},
	},
});

// This is a local signing-key test of the deployed JWT verifier, not a real
// GitHub exchange. OAuth browser acceptance remains a separate preview gate.
function token(subject, issuer = site) {
	const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: jwks.keys[0].kid })).toString(
		'base64url'
	);
	const now = Math.floor(Date.now() / 1000);
	const body = Buffer.from(
		JSON.stringify({ sub: subject, iss: issuer, aud: 'convex', iat: now, exp: now + 60 })
	).toString('base64url');
	const input = `${header}.${body}`;
	const signature = sign(
		'RSA-SHA256',
		Buffer.from(input),
		Buffer.from(secrets.AUTH_PRIVATE_KEY, 'base64')
	).toString('base64url');
	return `${input}.${signature}`;
}
const viewer = new ConvexHttpClient(cloud, { logger: false });
viewer.setAuth(token(userId));
const profile = await viewer.query(me, {});
assert.equal(profile?.id, userId);
assert.equal(profile?.systemRole, 'user');
assert.equal(await viewer.query(authenticated, {}), true);
const personal = makeFunctionReference('organizations:personal');
assert.equal((await viewer.query(personal, {}))?.role, 'owner');
await assert.rejects(() => anonymous.query(personal, {}));
viewer.setAuth(token(userId, 'https://other-deployment.example.test'));
await assert.rejects(() => viewer.query(me, {}));

// Exercise the actual deployed WASM password component through the admin API.
// Public clients cannot call component functions or these user callbacks.
const password = `Native proof ${randomUUID()}`;
const stored = await admin.function('public:setPassword', 'password', { userId, password });
assert.equal(stored.success, true);
assert.equal(
	(await admin.function('public:verifyPassword', 'password', { userId, password })).success,
	true
);
assert.equal(
	(
		await admin.function('public:verifyPassword', 'password', {
			userId,
			password: `Wrong ${password}`,
		})
	).success,
	false
);
await assert.rejects(() =>
	anonymous.function('public:setPassword', 'password', { userId, password })
);
await assert.rejects(() =>
	anonymous.mutation(makeFunctionReference('github:createUser'), {
		provider: {
			name: 'github',
			accountId: fixture,
			profile: {
				id: fixture,
				login: 'blocked',
				emailVerified: true,
				email: 'blocked@example.test',
			},
		},
	})
);
await assert.rejects(() =>
	anonymous.mutation(makeFunctionReference('github:startSignInGithub'), {
		redirectTo: 'https://untrusted.example.test/callback',
	})
);

console.log(
	'PASS: mounted JWKS, signed JWT/profile, personal organization, wrong issuer, anonymous access, callback privacy, redirect allowlist, and deployed WASM password checks.'
);
console.log(
	'Disposable user/password fixture retained only in the isolated local backend. Native Kino email/password UI acceptance is documented separately; real OAuth remains pending.'
);
