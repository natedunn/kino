import { splitSetCookieHeader } from 'better-auth/cookies';
import { convexBetterAuthReactStart } from 'kitcn/auth/start/server';

function createAuth() {
	return convexBetterAuthReactStart({
		convexUrl: import.meta.env.VITE_CONVEX_URL!,
		convexSiteUrl: import.meta.env.VITE_CONVEX_SITE_URL!,
	});
}

type AuthHelpers = ReturnType<typeof createAuth>;

let authSingleton: AuthHelpers | undefined;

function getAuth() {
	authSingleton ??= createAuth();
	return authSingleton;
}

function getRuntimeEnv() {
	return (
		(globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
	);
}

function getPortlessUrlEnv() {
	return (
		getRuntimeEnv().PORTLESS_URL ??
		(import.meta.env as Record<string, string | undefined>).VITE_PORTLESS_URL
	);
}

function isLocalDevHostname(hostname: string) {
	const normalized = hostname.toLowerCase();
	return (
		normalized === 'localhost' ||
		normalized === '127.0.0.1' ||
		normalized === '::1' ||
		normalized.endsWith('.localhost')
	);
}

export function publicAuthRequestUrl(requestUrl: string) {
	const portlessUrl = getPortlessUrlEnv();
	if (!portlessUrl) return requestUrl;

	try {
		const request = new URL(requestUrl);
		if (!isLocalDevHostname(request.hostname)) return requestUrl;

		const publicUrl = new URL(portlessUrl);
		publicUrl.pathname = request.pathname;
		publicUrl.search = request.search;
		publicUrl.hash = request.hash;
		return publicUrl.toString();
	} catch {
		return requestUrl;
	}
}

function withPublicAuthRequestUrl(request: Request) {
	const publicUrl = publicAuthRequestUrl(request.url);
	if (publicUrl === request.url) return request;

	const init: RequestInit & { duplex?: 'half' } = {
		body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
		duplex: 'half',
		headers: request.headers,
		method: request.method,
	};

	return new Request(publicUrl, init);
}

type HeadersWithSetCookieList = Headers & {
	getSetCookie?: () => Array<string>;
};

export function getSetCookieValues(source: Headers) {
	const getSetCookie = (source as HeadersWithSetCookieList).getSetCookie;
	if (typeof getSetCookie === 'function') {
		return getSetCookie.call(source).flatMap((value) => splitSetCookieHeader(value));
	}

	const setCookie = source.get('set-cookie');
	return setCookie ? splitSetCookieHeader(setCookie) : [];
}

function getSetCookieNames(source: Headers) {
	return getSetCookieValues(source)
		.map((value) => value.split('=', 1)[0]?.trim())
		.filter((value): value is string => !!value);
}

// Opt-in structured logging of auth request/redirect/cookie flow.
// Enable with AUTH_DEBUG=1 on the Worker when diagnosing OAuth issues.
function shouldLogAuthDebug() {
	return getRuntimeEnv().AUTH_DEBUG === '1';
}

function sanitizeAuthUrl(url: string) {
	try {
		const parsed = new URL(url);
		const safe = new URL(`${parsed.origin}${parsed.pathname}`);

		const callbackURL = parsed.searchParams.get('callbackURL');
		if (callbackURL) {
			safe.searchParams.set('callbackURL', callbackURL);
		}

		const error = parsed.searchParams.get('error');
		if (error) {
			safe.searchParams.set('error', error);
		}

		return safe.toString();
	} catch {
		return url;
	}
}

function isAuthDebugRequest(request: Request) {
	try {
		const { pathname } = new URL(request.url);
		return (
			pathname.startsWith('/api/auth/sign-in/social') ||
			pathname.startsWith('/api/auth/callback/') ||
			pathname.startsWith('/api/auth/oauth-proxy-callback') ||
			pathname.startsWith('/api/auth/get-session')
		);
	} catch {
		return false;
	}
}

function isSignInSocialRequest(request: Request) {
	try {
		const { pathname } = new URL(request.url);
		return pathname.startsWith('/api/auth/sign-in/social');
	} catch {
		return false;
	}
}

function getJsonRedirectUrl(body: string) {
	try {
		const parsed = JSON.parse(body) as { url?: unknown };
		return typeof parsed.url === 'string' ? parsed.url : null;
	} catch {
		return null;
	}
}

export async function syncSignInSocialLocationHeader(request: Request, response: Response) {
	const location = response.headers.get('location');
	if (!location || !isSignInSocialRequest(request)) return response;

	const body = await response
		.clone()
		.text()
		.catch(() => null);
	if (!body) return response;

	const redirectUrl = getJsonRedirectUrl(body);
	if (!redirectUrl || redirectUrl === location) return response;

	const headers = cloneHeadersPreservingSetCookie(response.headers);
	headers.set('location', redirectUrl);

	return new Response(body, {
		headers,
		status: response.status,
		statusText: response.statusText,
	});
}

function logAuthDebug(request: Request, response: Response, rewrittenLocation?: string) {
	if (!shouldLogAuthDebug() || !isAuthDebugRequest(request)) return;

	const location = rewrittenLocation ?? response.headers.get('location');
	const cookieNames = getSetCookieNames(response.headers);

	console.log(
		'[auth-debug]',
		JSON.stringify({
			cookieNames,
			location: location ? sanitizeAuthUrl(location) : null,
			method: request.method,
			requestUrl: sanitizeAuthUrl(request.url),
			status: response.status,
		})
	);
}

/**
 * Rewrites this deployment's own convex.site auth redirects onto the current
 * app origin so cookies land on the app host. (Cross-environment proxy
 * callback rewriting — the old prod-as-trampoline role — is handled by the
 * gateway Worker now; see workers/gateway/src/redirect-rewrite.ts.)
 */
export function rewriteAuthRedirectLocation({
	convexSiteUrl,
	location,
	requestUrl,
}: {
	convexSiteUrl: string;
	location: string;
	requestUrl: string;
}) {
	try {
		const request = new URL(requestUrl);
		const target = new URL(location, request);
		const convexSite = new URL(convexSiteUrl);

		if (target.origin !== convexSite.origin) {
			return location;
		}

		if (!target.pathname.startsWith('/api/auth/')) {
			return location;
		}

		target.protocol = request.protocol;
		target.host = request.host;

		return target.toString();
	} catch {
		return location;
	}
}

export function cloneHeadersPreservingSetCookie(source: Headers) {
	const headers = new Headers();

	for (const [key, value] of source.entries()) {
		if (key.toLowerCase() === 'set-cookie') continue;
		headers.append(key, value);
	}

	const getSetCookie = (source as HeadersWithSetCookieList).getSetCookie;
	if (typeof getSetCookie === 'function') {
		for (const value of getSetCookieValues(source)) {
			headers.append('set-cookie', value);
		}
		return headers;
	}

	for (const value of getSetCookieValues(source)) {
		headers.append('set-cookie', value);
	}

	return headers;
}

function cloneAuthResponse(response: Response) {
	return new Response(response.body, {
		headers: cloneHeadersPreservingSetCookie(response.headers),
		status: response.status,
		statusText: response.statusText,
	});
}

export async function handler(request: Request) {
	// Production is "just another environment" behind the gateway: every env's
	// sign-in takes the oAuthProxy leg via OAUTH_PROXY_PRODUCTION_URL. (The old
	// first-party x-skip-oauth-proxy bypass for usekino.com is gone — GitHub's
	// registered callback now points at the gateway, so skipping the proxy
	// produces a redirect_uri GitHub rejects.)
	const publicRequest = withPublicAuthRequestUrl(request);
	const response = await syncSignInSocialLocationHeader(
		publicRequest,
		await getAuth().handler(publicRequest)
	);
	const location = response.headers.get('location');

	if (!location) {
		const clonedResponse = cloneAuthResponse(response);
		logAuthDebug(publicRequest, clonedResponse);
		return clonedResponse;
	}

	const rewrittenLocation = rewriteAuthRedirectLocation({
		convexSiteUrl: import.meta.env.VITE_CONVEX_SITE_URL!,
		location,
		requestUrl: publicRequest.url,
	});

	if (rewrittenLocation === location) {
		const clonedResponse = cloneAuthResponse(response);
		logAuthDebug(publicRequest, clonedResponse);
		return clonedResponse;
	}

	const headers = cloneHeadersPreservingSetCookie(response.headers);
	headers.set('location', rewrittenLocation);

	const rewrittenResponse = new Response(response.body, {
		headers,
		status: response.status,
		statusText: response.statusText,
	});

	logAuthDebug(publicRequest, rewrittenResponse, rewrittenLocation);

	return rewrittenResponse;
}

export const getToken: AuthHelpers['getToken'] = () => getAuth().getToken();

export const fetchAuthQuery: AuthHelpers['fetchAuthQuery'] = (...args) => {
	return getAuth().fetchAuthQuery(...args);
};

export const fetchAuthMutation: AuthHelpers['fetchAuthMutation'] = (...args) => {
	return getAuth().fetchAuthMutation(...args);
};

export const fetchAuthAction: AuthHelpers['fetchAuthAction'] = (...args) => {
	return getAuth().fetchAuthAction(...args);
};
