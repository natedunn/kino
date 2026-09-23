import type { GatewayEnv } from './env';
import type { Route, Routes } from './native-routing';

import { decodeProtectedHeader } from 'jose';

import { isAuthorizedAdmin, isStaticallyTrustedTargetOrigin } from './env';
import { validateRoute } from './native-routing';

const PREFIX = 'native-oauth-route:';
const TTL_SECONDS = 60 * 60 * 24 * 14;
const ID_PATTERN = /^[a-z0-9-]{1,64}$/;
const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };

export function dynamicNativeRoutesEnabled(env: GatewayEnv) {
	return env.QUICK_TUNNEL_TARGETS_ENABLED === 'true' && !!env.TARGETS;
}

function validPreviewRoute(env: GatewayEnv, route: Route) {
	try {
		validateRoute(route);
		const backend = new URL(route.backendCallback);
		const app = new URL(route.appCallback);
		return (
			backend.href === route.backendCallback &&
			backend.hostname.endsWith('.convex.site') &&
			backend.hostname !== 'convex.site' &&
			!backend.port &&
			app.href === route.appCallback &&
			app.hostname.endsWith('.workers.dev') &&
			!app.port &&
			isStaticallyTrustedTargetOrigin(env, app.origin) &&
			route.secret.length >= 32 &&
			route.secret.length <= 512
		);
	} catch {
		return false;
	}
}

async function getDynamicRoute(env: GatewayEnv, id: string): Promise<Route | null> {
	if (!dynamicNativeRoutesEnabled(env) || !ID_PATTERN.test(id)) return null;
	const route = await env.TARGETS.get<Route>(`${PREFIX}${id}`, 'json');
	return route && validPreviewRoute(env, route) ? route : null;
}

export async function routesForEnvelope(
	env: GatewayEnv,
	envelope: string,
	staticRoutes: Routes
): Promise<Routes> {
	let id: unknown;
	try {
		id = decodeProtectedHeader(envelope).kid;
	} catch {
		return staticRoutes;
	}
	if (typeof id !== 'string' || !ID_PATTERN.test(id)) return staticRoutes;
	const dynamic = await getDynamicRoute(env, id);
	return dynamic ? { ...staticRoutes, [id]: dynamic } : staticRoutes;
}

export async function handleNativeRouteApi(env: GatewayEnv, request: Request): Promise<Response> {
	if (!dynamicNativeRoutesEnabled(env)) return new Response('Not found', { status: 404 });
	if (!isAuthorizedAdmin(env, request)) return new Response('Unauthorized', { status: 401 });
	const path = new URL(request.url).pathname;
	const id = path.startsWith('/oauth/routes/') ? path.slice('/oauth/routes/'.length) : '';
	if (!ID_PATTERN.test(id)) return new Response('Invalid route ID', { status: 400 });
	const key = `${PREFIX}${id}`;

	if (request.method === 'GET') {
		const route = await getDynamicRoute(env, id);
		if (!route) return new Response('Not found', { status: 404 });
		return Response.json(
			{ id, backendCallback: route.backendCallback, appCallback: route.appCallback },
			{ headers }
		);
	}
	if (request.method === 'DELETE') {
		await env.TARGETS.delete(key);
		return Response.json({ ok: true }, { headers });
	}
	if (request.method !== 'PUT') return new Response('Method not allowed', { status: 405 });

	let route: Route;
	try {
		const raw = await request.text();
		if (raw.length > 4096) throw new Error();
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
		const candidate = parsed as Partial<Route>;
		if (
			typeof candidate.backendCallback !== 'string' ||
			typeof candidate.appCallback !== 'string' ||
			typeof candidate.secret !== 'string'
		)
			throw new Error();
		route = candidate as Route;
	} catch {
		return new Response('Invalid route body', { status: 400 });
	}
	if (!validPreviewRoute(env, route)) {
		return new Response('Route callbacks must be exact trusted preview URLs', { status: 400 });
	}
	await env.TARGETS.put(key, JSON.stringify(route), { expirationTtl: TTL_SECONDS });
	return Response.json(
		{ id, backendCallback: route.backendCallback, appCallback: route.appCallback },
		{ headers }
	);
}
