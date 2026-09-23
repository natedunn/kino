import { ConvexHttpClient } from 'convex/browser';
import { SignJWT } from 'jose';

import { api } from '../../../../convex/native/_generated/api';

const STATE_COOKIE = 'kinoNativeGithubState';
const RETURN_COOKIE = 'kinoNativeGithubReturn';
const REFERENCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const AUTHORIZATION_URL_BUDGET = 1024;

type ProxySignIn = (request: Request) => Promise<Response>;

async function resolveRouteId(origin: string, explicitRouteId?: string) {
	if (explicitRouteId) return explicitRouteId;
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(origin));
	const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
		''
	);
	return `preview-${hex.slice(0, 40)}`;
}

async function gatewayConfig(origin: string) {
	const gatewayValue = process.env.NATIVE_GITHUB_GATEWAY_URL;
	const routeId = await resolveRouteId(origin, process.env.NATIVE_GITHUB_ROUTE_ID);
	const secret = process.env.NATIVE_GITHUB_ROUTE_SECRET;
	if (!gatewayValue || !routeId || !secret) throw new Error('Missing native GitHub configuration');
	const gateway = new URL(gatewayValue);
	if (
		gateway.protocol !== 'https:' ||
		gateway.username ||
		gateway.password ||
		gateway.pathname !== '/oauth/github/callback' ||
		gateway.search ||
		gateway.hash
	)
		throw new Error('Invalid native GitHub gateway URL');
	if (!/^[a-z0-9-]{1,64}$/.test(routeId)) throw new Error('Invalid native GitHub route ID');
	if (secret.length < 32) throw new Error('Invalid native GitHub route secret');
	return { gateway, routeId, secret };
}

function cookieValue(request: Request, name: string) {
	for (const part of (request.headers.get('cookie') ?? '').split(';')) {
		const [key, ...value] = part.trim().split('=');
		if (key === name) {
			try {
				return decodeURIComponent(value.join('='));
			} catch {
				return undefined;
			}
		}
	}
	return undefined;
}

function cookie(request: Request, name: string, value: string, maxAge: number) {
	return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/api/auth/github; HttpOnly; SameSite=Lax${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}

function safeReturnPath(raw: unknown, origin: string) {
	if (typeof raw !== 'string') return '/dashboard';
	try {
		const target = new URL(raw, origin);
		if (target.origin !== origin || target.username || target.password) return '/dashboard';
		return target.pathname + target.search + target.hash;
	} catch {
		return '/dashboard';
	}
}

async function routeEnvelope(routeId: string, state: string, secret: string) {
	if (state.length < 20 || state.length > 256) throw new Error('Invalid provider state');
	const now = Math.floor(Date.now() / 1000);
	return new SignJWT({ state })
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT', kid: routeId })
		.setIssuer(routeId)
		.setAudience('kino-convex-v2-github-gateway')
		.setIssuedAt(now)
		.setExpirationTime(now + 600)
		.sign(new TextEncoder().encode(secret));
}

function end(request: Request, location: string, status = 303) {
	const response = new Response(null, {
		status,
		headers: {
			Location: location,
			'Cache-Control': 'private, no-store',
			'Referrer-Policy': 'no-referrer',
		},
	});
	response.headers.append('Set-Cookie', cookie(request, STATE_COOKIE, '', 0));
	response.headers.append('Set-Cookie', cookie(request, RETURN_COOKIE, '', 0));
	return response;
}

export async function startNativeGithub(request: Request) {
	const requestUrl = new URL(request.url);
	if (request.headers.get('origin') !== requestUrl.origin)
		return new Response('Forbidden', { status: 403 });
	let config: Awaited<ReturnType<typeof gatewayConfig>>;
	try {
		config = await gatewayConfig(requestUrl.origin);
	} catch {
		return new Response('Native GitHub is not configured', { status: 503 });
	}
	let input: unknown;
	try {
		input = await request.json();
	} catch {
		return new Response('Invalid request', { status: 400 });
	}
	const callbackURL = safeReturnPath(
		(input as { callbackURL?: unknown } | null)?.callbackURL,
		requestUrl.origin
	);
	const client = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);
	let flow: { redirect: string; state: string };
	try {
		flow = await client.mutation(api.github.startSignInGithub, {
			redirectTo: `${requestUrl.origin}/api/auth/github/callback`,
		});
	} catch (error) {
		console.error('[native-github] Convex start failed', error);
		return new Response('Native GitHub is temporarily unavailable', { status: 502 });
	}
	const redirect = new URL(flow.redirect);
	const originalState = redirect.searchParams.get('state');
	const providerCallback = redirect.searchParams.get('redirect_uri');
	if (!originalState || providerCallback !== config.gateway.href)
		throw new Error('Unexpected native GitHub provider redirect');

	const envelope = await routeEnvelope(config.routeId, originalState, config.secret);
	let registered: Response;
	try {
		registered = await fetch(new URL('/oauth/state', config.gateway).href, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ envelope }),
			redirect: 'manual',
			signal: AbortSignal.timeout(10_000),
		});
	} catch (error) {
		console.error('[native-github] gateway registration request failed', error);
		return new Response('Native GitHub is temporarily unavailable', { status: 502 });
	}
	if (!registered.ok) {
		console.error(
			'[native-github] gateway registration rejected',
			registered.status,
			registered.url
		);
		return new Response('Native GitHub is temporarily unavailable', { status: 502 });
	}
	let registeredBody: { state?: unknown };
	try {
		registeredBody = (await registered.json()) as typeof registeredBody;
	} catch (error) {
		console.error('[native-github] gateway registration returned invalid JSON', error);
		return new Response('Native GitHub is temporarily unavailable', { status: 502 });
	}
	if (typeof registeredBody.state !== 'string' || !REFERENCE_PATTERN.test(registeredBody.state))
		throw new Error('Invalid native GitHub state reference');
	redirect.searchParams.set('state', registeredBody.state);
	if (new TextEncoder().encode(redirect.href).length > AUTHORIZATION_URL_BUDGET)
		throw new Error('Native GitHub authorization URL exceeds its budget');

	const response = Response.json(
		{ redirect: redirect.href },
		{ headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } }
	);
	response.headers.append('Set-Cookie', cookie(request, STATE_COOKIE, flow.state, 600));
	response.headers.append('Set-Cookie', cookie(request, RETURN_COOKIE, callbackURL, 600));
	return response;
}

export async function completeNativeGithub(request: Request, proxySignIn: ProxySignIn) {
	const url = new URL(request.url);
	const origin = url.origin;
	const returnPath = safeReturnPath(cookieValue(request, RETURN_COOKIE), origin);
	const state = cookieValue(request, STATE_COOKIE);
	const code = url.searchParams.get('convexAuthCode');
	const error = url.searchParams.get('convexAuthError');
	if (!state || !code || error) {
		const failure = error === 'access_denied' ? 'access_denied' : 'invalid_flow';
		return end(request, `${origin}/auth?oauthError=${failure}`);
	}
	const proxyRequest = new Request(`${origin}/api/auth/signin?path=/api/mutation`, {
		method: 'POST',
		headers: { Origin: origin, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			path: 'github:completeSignInGithub',
			format: 'convex_encoded_json',
			args: [{ code, state }],
		}),
	});
	const proxy = await proxySignIn(proxyRequest);
	let result: { status?: string; value?: { status?: string } } = {};
	try {
		result = (await proxy.json()) as typeof result;
	} catch {
		return end(request, `${origin}/auth?oauthError=invalid_flow`);
	}
	if (!proxy.ok || result.status !== 'success' || result.value?.status !== 'complete')
		return end(request, `${origin}/auth?oauthError=invalid_flow`);
	const response = end(request, `${origin}${returnPath}`);
	for (const setCookie of proxy.headers.getSetCookie())
		response.headers.append('Set-Cookie', setCookie);
	return response;
}

export const nativeGithubTestHelpers = { safeReturnPath, resolveRouteId };
