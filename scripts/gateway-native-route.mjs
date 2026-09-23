#!/usr/bin/env node
import { createHash } from 'node:crypto';

const appOrigin = process.env.VITE_SITE_URL;
const convexSiteOrigin = process.env.VITE_CONVEX_SITE_URL;
const gatewayOrigin = process.env.GATEWAY_URL;
const gatewayCallback = process.env.NATIVE_GITHUB_GATEWAY_URL;
const adminToken = process.env.GATEWAY_ADMIN_TOKEN;
const secret = process.env.NATIVE_GITHUB_ROUTE_SECRET;

function exactOrigin(value, label) {
	const url = new URL(value);
	if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password)
		throw new Error(`${label} must be an exact HTTPS origin`);
	return url;
}

if (!appOrigin || !convexSiteOrigin || !gatewayOrigin || !gatewayCallback || !adminToken || !secret)
	throw new Error('Native preview route registration requires app, Convex, gateway, admin token, and route secret');
if (secret.length < 32) throw new Error('Native preview route secret is too short');

const app = exactOrigin(appOrigin, 'VITE_SITE_URL');
const convex = exactOrigin(convexSiteOrigin, 'VITE_CONVEX_SITE_URL');
const gateway = exactOrigin(gatewayOrigin, 'GATEWAY_URL');
const callback = new URL(gatewayCallback);
if (
	callback.origin !== gateway.origin ||
	callback.pathname !== '/oauth/github/callback' ||
	callback.search || callback.hash || callback.username || callback.password
)
	throw new Error('Native GitHub callback must match the selected gateway');
if (!convex.hostname.endsWith('.convex.site'))
	throw new Error('Native preview route requires a Convex site URL');

const routeId = `preview-${createHash('sha256').update(app.origin).digest('hex').slice(0, 40)}`;
const response = await fetch(new URL(`/oauth/routes/${routeId}`, gateway), {
	method: 'PUT',
	headers: {
		Authorization: `Bearer ${adminToken}`,
		'Content-Type': 'application/json',
	},
	body: JSON.stringify({
		backendCallback: `${convex.origin}/oauth/github/callback`,
		appCallback: `${app.origin}/api/auth/github/callback`,
		secret,
	}),
	signal: AbortSignal.timeout(10_000),
});
if (!response.ok) throw new Error(`Native preview route registration failed (${response.status})`);
console.log(`Registered native GitHub route ${routeId} for ${app.origin}`);
