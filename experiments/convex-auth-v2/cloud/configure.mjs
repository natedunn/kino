import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import { exportJWK, exportPKCS8, generateKeyPair } from 'jose';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const save = (path, value) =>
	writeFileSync(new URL(path, root), JSON.stringify(value), { mode: 0o600 });
const d = JSON.parse(read('cloud/deployment.json'));
const { CONVEX_DEPLOY_KEY: k } = parseEnv(read('cloud/.env.deploy.local'));
if (
	d.type !== 'preview' ||
	d.name !== 'graceful-elephant-103' ||
	k.split('|')[0].split(':').at(-1) !== d.name
)
	throw new Error('Wrong target');
const git = parseEnv(read('github/.env.github.local'));
const pair = await generateKeyPair('RS256', { extractable: true });
const pub = await exportJWK(pair.publicKey);
pub.use = 'sig';
pub.alg = 'RS256';
pub.kid = 'cloud-proof';
const vars = {
	AUTH_PRIVATE_KEY: Buffer.from(await exportPKCS8(pair.privateKey)).toString('base64'),
	AUTH_JWKS: JSON.stringify({ keys: [pub] }),
	AUTH_GITHUB_CLIENT_ID: git.AUTH_GITHUB_CLIENT_ID,
	AUTH_GITHUB_CLIENT_SECRET: git.AUTH_GITHUB_CLIENT_SECRET,
	AUTH_GITHUB_CALLBACK_URL:
		'https://kino-v2-gateway-proof-c318c09d.hello-fc8.workers.dev/oauth/github/callback',
	BENTO_PUBLISHABLE_KEY: 'disabled',
	BENTO_SECRET_KEY: 'disabled',
	BENTO_SITE_UUID: 'disabled',
	BENTO_FROM: 'disabled',
	PROOF_EMAIL: 'disabled',
};
save('cloud/.env.backend.local.json', vars);
const r = await fetch(d.url + '/api/update_environment_variables', {
	method: 'POST',
	headers: { Authorization: `Convex ${k}`, 'Content-Type': 'application/json' },
	body: JSON.stringify({ changes: Object.entries(vars).map(([name, value]) => ({ name, value })) }),
});
console.log({ environmentUpdateStatus: r.status });
if (!r.ok) process.exit(1);
const secret = randomBytes(32).toString('hex');
save('start/.env.routing.local.json', { PROOF_ROUTING_SECRET: secret });
const routes = {
	'c318c09d-alpha': {
		backendCallback: d.url.replace('.convex.cloud', '.convex.site') + '/oauth/github/callback',
		appCallback:
			'https://kino-auth-v2-proof-c318c09d.hello-fc8.workers.dev/api/auth/github/callback',
		secret,
	},
};
save('cloud/.env.routes.local.json', { PROOF_ROUTES: JSON.stringify(routes) });
