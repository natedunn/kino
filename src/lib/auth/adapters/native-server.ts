import { httpCookies, ServerAuthSession, setupConvexAuthServer } from '@convex-dev/auth/server';
import { getRequest, setResponseHeader } from '@tanstack/react-start/server';
import { ConvexHttpClient } from 'convex/browser';

import { api } from '../../../../convex/native/_generated/api';
import { completeNativeGithub, startNativeGithub } from './native-github-server';

function requireConvexUrl() {
	const value = import.meta.env.VITE_CONVEX_URL;
	if (!value) throw new Error('VITE_CONVEX_URL is required for native auth.');
	return value;
}

function authRoutes(request: Request) {
	const requestUrl = new URL(request.url);
	return setupConvexAuthServer({
		convexUrl: requireConvexUrl(),
		refreshSession: api.auth.refreshSession,
		signOut: api.auth.signOut,
		signIn: [api.password.signIn, api.password.verifyEmail, api.github.completeSignInGithub],
		allowedOrigins: [requestUrl.origin],
		cookieOptions: { secure: requestUrl.protocol === 'https:' },
	});
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * Portless proxies each worktree's dev server from `https://<name>.localhost:1355`
 * to a loopback Vite port, so `request.url` carries the internal host. In dev
 * builds only, rebuild the browser-facing URL from the proxy's forwarded headers
 * so origin checks, cookies, and OAuth redirects use the real origin. Deployed
 * environments never trust forwarded headers.
 */
export function withPublicDevUrl(request: Request, isDev: boolean) {
	if (!isDev) return request;
	const url = new URL(request.url);
	const forwardedHost = request.headers.get('x-forwarded-host');
	const forwardedProto = request.headers.get('x-forwarded-proto');
	if (!LOOPBACK_HOSTS.has(url.hostname) || !forwardedHost) return request;
	if (forwardedProto !== 'https' && forwardedProto !== 'http') return request;
	let publicUrl: URL;
	try {
		publicUrl = new URL(`${forwardedProto}://${forwardedHost}${url.pathname}${url.search}`);
	} catch {
		return request;
	}
	if (publicUrl.host !== forwardedHost || !publicUrl.hostname.endsWith('.localhost'))
		return request;
	return new Request(publicUrl, request);
}

function noStore(response: Response) {
	response.headers.set('Cache-Control', 'private, no-store');
	return response;
}

export async function handleNativeAuthRequest(incoming: Request) {
	const request = withPublicDevUrl(incoming, import.meta.env.DEV);
	const { pathname } = new URL(request.url);
	if (pathname === '/api/auth/github/callback' && request.method === 'GET')
		return completeNativeGithub(request, (proxyRequest) =>
			authRoutes(proxyRequest).convexProxyHandler(proxyRequest)
		);
	if (pathname === '/api/auth/github/start' && request.method === 'POST')
		return startNativeGithub(request);
	if (request.method !== 'POST') return new Response('Not found', { status: 404 });

	const routes = authRoutes(request);
	const handler =
		pathname === '/api/auth/signin'
			? routes.convexProxyHandler
			: pathname === '/api/auth/refresh'
				? routes.refreshHandler
				: pathname === '/api/auth/signout'
					? routes.signOutHandler
					: null;
	return handler ? noStore(await handler(request)) : new Response('Not found', { status: 404 });
}

const pendingTokens = new WeakMap<Request, Promise<string | null>>();

export async function getNativeServerAuthToken() {
	const request = getRequest();
	let pending = pendingTokens.get(request);
	if (!pending) {
		pending = (async () => {
			const cookies = httpCookies(request);
			const client = new ConvexHttpClient(requireConvexUrl());
			const session = new ServerAuthSession({
				cookies,
				cookieOptions: { secure: new URL(request.url).protocol === 'https:' },
				refreshSession: (refreshToken) =>
					client.mutation(api.auth.refreshSession, { refreshToken }),
			});
			const token = await session.getToken();
			const headers = new Headers();
			cookies.applyTo(headers);
			const setCookies = headers.getSetCookie();
			if (setCookies.length > 0) setResponseHeader('Set-Cookie', setCookies);
			setResponseHeader('Cache-Control', 'private, no-store');
			return token;
		})();
		pendingTokens.set(request, pending);
	}
	return pending;
}
