const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * The exact origins a local (anonymous) Convex backend needs. Each dev worktree
 * runs its own backend on its own port, so this allows only the URL this server
 * was configured with — never a loopback wildcard — keeping worktrees siloed.
 * Production Convex URLs are HTTPS and already covered by `https: wss:`.
 */
export function localConvexConnectSources(convexUrl: string | undefined): Array<string> {
	if (!convexUrl) return [];
	let url: URL;
	try {
		url = new URL(convexUrl);
	} catch {
		return [];
	}
	if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname) || !url.port) return [];
	return [url.origin, `ws://${url.host}`];
}

const DEFAULT_CONNECT_SOURCES = import.meta.env.DEV
	? localConvexConnectSources(import.meta.env.VITE_CONVEX_URL)
	: [];

function contentSecurityPolicy(connectSources: Array<string>) {
	return [
		"default-src 'self'",
		"base-uri 'self'",
		"object-src 'none'",
		"frame-ancestors 'none'",
		"form-action 'self'",
		"script-src 'self' 'unsafe-inline'",
		"script-src-attr 'none'",
		"style-src 'self' 'unsafe-inline'",
		"font-src 'self' data:",
		"img-src 'self' data: blob: https:",
		"media-src 'self' blob: https:",
		["connect-src 'self' https: wss:", ...connectSources].join(' '),
		"worker-src 'self' blob:",
		"manifest-src 'self'",
	].join('; ');
}

const PERMISSIONS_POLICY = [
	'accelerometer=()',
	'camera=()',
	'geolocation=()',
	'gyroscope=()',
	'magnetometer=()',
	'microphone=()',
	'payment=()',
	'usb=()',
].join(', ');

/** Add browser hardening without buffering or otherwise consuming the response body. */
export function withSecurityHeaders(
	request: Request,
	response: Response,
	{ connectSources = DEFAULT_CONNECT_SOURCES }: { connectSources?: Array<string> } = {}
): Response {
	const headers = new Headers(response.headers);

	headers.set('Content-Security-Policy', contentSecurityPolicy(connectSources));
	headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
	headers.set('Permissions-Policy', PERMISSIONS_POLICY);
	headers.set('X-Content-Type-Options', 'nosniff');
	headers.set('X-DNS-Prefetch-Control', 'off');
	headers.set('X-Frame-Options', 'DENY');
	if (!headers.has('Referrer-Policy'))
		headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	if (new URL(request.url).protocol === 'https:') {
		headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
