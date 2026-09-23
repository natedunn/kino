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

function noStore(response: Response) {
	response.headers.set('Cache-Control', 'private, no-store');
	return response;
}

export async function handleNativeAuthRequest(request: Request) {
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
