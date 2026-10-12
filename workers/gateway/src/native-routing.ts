// Server-only routing envelopes. The registry, never the browser, owns URLs.
import { jwtVerify, SignJWT } from 'jose';

// `local` routes serve a developer worktree: the backend is that worktree's
// loopback Convex site, which only the developer's browser can reach.
export type Route = { backendCallback: string; appCallback: string; secret: string; local?: true };
export type Routes = Record<string, Route>;
const audience = 'kino-convex-v2-github-gateway';
const key = (secret: string) => {
	if (secret.length < 32) throw new Error('Routing key must be at least 32 characters');
	return new TextEncoder().encode(secret);
};
function validateLocalRoute(route: Route) {
	const backend = new URL(route.backendCallback);
	const app = new URL(route.appCallback);
	for (const url of [backend, app])
		if (url.username || url.password || url.search || url.hash)
			throw new Error('Local routing requires exact callback URLs');
	if (
		backend.href !== route.backendCallback ||
		backend.protocol !== 'http:' ||
		backend.hostname !== '127.0.0.1' ||
		!backend.port ||
		backend.pathname !== '/oauth/github/callback' ||
		app.href !== route.appCallback ||
		app.protocol !== 'https:' ||
		!app.hostname.endsWith('.localhost') ||
		app.pathname !== '/api/auth/github/callback'
	)
		throw new Error('Local routing requires exact loopback and localhost callback URLs');
}
export function validateRoute(route: Route) {
	// Routes come from KV, request bodies, and secrets, so check the kind at runtime.
	const kind: unknown = route.local;
	if (kind === true) return validateLocalRoute(route);
	if (kind !== undefined) throw new Error('Invalid route kind');
	for (const [value, path] of [
		[route.backendCallback, '/oauth/github/callback'],
		[route.appCallback, '/api/auth/github/callback'],
	]) {
		const url = new URL(value);
		if (
			url.protocol !== 'https:' ||
			url.username ||
			url.password ||
			url.search ||
			url.hash ||
			url.pathname !== path
		)
			throw new Error('Routing requires exact HTTPS callback URLs');
	}
}
export function parseNativeRoutes(raw: string | undefined): Routes | null {
	if (!raw) return null;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
		const entries = Object.entries(parsed);
		if (entries.length === 0) return null;
		const routes: Routes = {};
		for (const [id, value] of entries) {
			if (!/^[a-z0-9-]{1,64}$/.test(id) || !value || typeof value !== 'object') return null;
			const route = value as Route;
			// Static routes describe deployed environments; local routes are only
			// ever registered at runtime in the dev gateway.
			if (
				Object.hasOwn(route, 'local') ||
				typeof route.secret !== 'string' ||
				route.secret.length < 32 ||
				typeof route.backendCallback !== 'string' ||
				typeof route.appCallback !== 'string'
			)
				return null;
			validateRoute(route);
			routes[id] = route;
		}
		return routes;
	} catch {
		return null;
	}
}
export async function signRoute(
	id: string,
	state: string,
	secret: string,
	now = Math.floor(Date.now() / 1000)
) {
	if (!/^[a-z0-9-]{1,64}$/.test(id) || state.length < 20 || state.length > 256)
		throw new Error('Invalid routing state');
	return new SignJWT({ state })
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT', kid: id })
		.setIssuer(id)
		.setAudience(audience)
		.setIssuedAt(now)
		.setExpirationTime(now + 600)
		.sign(key(secret));
}
export async function resolveRoute(envelope: string, routes: Routes, now = new Date()) {
	const { payload, protectedHeader } = await jwtVerify(
		envelope,
		(header) => {
			if (typeof header.kid !== 'string' || !Object.hasOwn(routes, header.kid))
				throw new Error('Unknown route');
			return key(routes[header.kid].secret);
		},
		{
			algorithms: ['HS256'],
			typ: 'JWT',
			audience,
			currentDate: now,
			maxTokenAge: '10m',
			requiredClaims: ['exp', 'iat', 'iss'],
		}
	);
	const id = protectedHeader.kid!;
	if (
		payload.iss !== id ||
		typeof payload.state !== 'string' ||
		payload.state.length < 20 ||
		payload.state.length > 256 ||
		typeof payload.iat !== 'number' ||
		typeof payload.exp !== 'number' ||
		payload.exp > payload.iat + 600
	)
		throw new Error('Invalid routing claims');
	const route = routes[id];
	validateRoute(route);
	return { route, state: payload.state };
}
