#!/usr/bin/env node
// Registers this worktree as a `local` native GitHub route on the dev gateway,
// then records the route in `.env.local` for the Start server. The gateway
// hands the GitHub callback to this worktree's loopback Convex by browser
// redirect (see workers/gateway/src/native-oauth.ts and
// docs/github-environments.md). Best-effort: without gateway credentials or a
// loopback Convex site, GitHub login stays off and `pnpm dev` continues.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { localRouteId, newRouteSecret, rewriteManagedEnv } from './lib/gateway-local-route.mjs';
import { readEnvFile } from './lib/local-convex.mjs';

const workspaceRoot = process.cwd();
const envPath = path.join(workspaceRoot, '.env.local');
const env = readEnvFile(envPath);

function writeEnv(values) {
	const content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
	fs.writeFileSync(envPath, rewriteManagedEnv(content, values), { mode: 0o600 });
}

function disable(reason) {
	console.log(`[gateway-local-route] GitHub login disabled: ${reason}`);
	writeEnv({ ...env, VITE_NATIVE_GITHUB_ENABLED: 'false' });
	process.exit(0);
}

function appOrigin() {
	const explicit = process.env.VITE_SITE_URL ?? process.env.PORTLESS_URL;
	if (explicit) return new URL(explicit).origin;
	const name = spawnSync('sh', ['scripts/portless-name.sh', 'kino'], {
		cwd: workspaceRoot,
		encoding: 'utf8',
	}).stdout.trim();
	return `https://${name}.localhost:${process.env.PORTLESS_PORT ?? '1355'}`;
}

if (!env.GATEWAY_URL || !env.GATEWAY_ADMIN_TOKEN)
	disable('.env.local has no GATEWAY_URL/GATEWAY_ADMIN_TOKEN');
const site = env.VITE_CONVEX_SITE_URL ? new URL(env.VITE_CONVEX_SITE_URL) : null;
if (!site || site.protocol !== 'http:' || site.hostname !== '127.0.0.1' || !site.port)
	disable('the Convex site is not this worktree’s loopback backend');

const gateway = new URL(env.GATEWAY_URL);
const app = appOrigin();
// Never reuse `.env.local`'s key: it may have been copied from another worktree.
const secret = newRouteSecret();
const routeId = localRouteId(app);

let response;
try {
	response = await fetch(new URL(`/oauth/routes/${routeId}`, gateway), {
		method: 'PUT',
		headers: {
			Authorization: `Bearer ${env.GATEWAY_ADMIN_TOKEN}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			backendCallback: `${site.origin}/oauth/github/callback`,
			appCallback: `${app}/api/auth/github/callback`,
			secret,
			local: true,
		}),
		signal: AbortSignal.timeout(10_000),
	});
} catch (error) {
	disable(`the dev gateway is unreachable (${error.message})`);
}
if (!response.ok) disable(`the dev gateway rejected the route (${response.status})`);

writeEnv({
	...env,
	NATIVE_GITHUB_GATEWAY_URL: new URL('/oauth/github/callback', gateway).href,
	NATIVE_GITHUB_ROUTE_ID: routeId,
	NATIVE_GITHUB_ROUTE_SECRET: secret,
	VITE_NATIVE_GITHUB_ENABLED: 'true',
});
console.log(`[gateway-local-route] registered ${routeId} for ${app}`);
