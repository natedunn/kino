const CONTENT_SECURITY_POLICY = [
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
	"connect-src 'self' https: wss:",
	"worker-src 'self' blob:",
	"manifest-src 'self'",
].join('; ');

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
export function withSecurityHeaders(request: Request, response: Response): Response {
	const headers = new Headers(response.headers);

	headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
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
