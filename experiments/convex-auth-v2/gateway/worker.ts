import type { Routes } from './routing';

import { resolveRoute } from './routing';

// Local legacy proof remains available; deployed entrypoint requires signed routes.
export async function callback(
	request: Request,
	send: (input: URL, init: RequestInit) => Promise<Response> = fetch,
	routes?: Routes,
	resolveState?: (state: string) => ReturnType<typeof resolveRoute>
): Promise<Response> {
	const url = new URL(request.url);
	const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
	if (url.pathname === '/health')
		return Response.json({ ok: true, protocol: 'convex-auth-v2-proof' }, { headers });
	if (url.pathname !== '/oauth/github/callback')
		return new Response('Not found', { status: 404, headers });
	if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers });
	const state = url.searchParams.get('state');
	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');
	if (
		url.search.length > 4096 ||
		!state ||
		state.length < 20 ||
		state.length > (routes ? 2048 : 256) ||
		(!code && !error) ||
		(code && error) ||
		['state', 'code', 'error'].some((k) => url.searchParams.getAll(k).length > 1)
	)
		return new Response('Invalid callback', { status: 400, headers });
	let backendCallback = 'http://127.0.0.1:4421/oauth/github/callback';
	let appCallback = 'https://127.0.0.1:5183/api/auth/github/callback';
	let originalState = state;
	if (routes) {
		try {
			const resolved = await (resolveState ? resolveState(state) : resolveRoute(state, routes));
			({ backendCallback, appCallback } = resolved.route);
			originalState = resolved.state;
		} catch {
			return new Response('Invalid routing state', { status: 400, headers });
		}
	}
	const target = new URL(backendCallback);
	for (const key of ['state', 'code', 'error', 'error_description']) {
		const value = url.searchParams.get(key);
		if (value) target.searchParams.set(key, value);
	}
	target.searchParams.set('state', originalState);
	let response: Response;
	try {
		response = await send(target, {
			redirect: 'manual',
			headers: { Accept: 'text/html' },
			signal: AbortSignal.timeout(15000),
		});
	} catch {
		return new Response('Backend unavailable', { status: 502, headers });
	}
	if (response.status === 302 || response.status === 303) {
		const location = response.headers.get('location');
		if (!location) return new Response('Missing callback destination', { status: 502, headers });
		let destination: URL;
		try {
			destination = new URL(location);
		} catch {
			return new Response('Invalid callback destination', { status: 502, headers });
		}
		if (
			destination.username ||
			destination.password ||
			destination.origin !== new URL(appCallback).origin ||
			destination.pathname !== new URL(appCallback).pathname ||
			destination.hash
		)
			return new Response('Untrusted callback destination', { status: 502, headers });
		return new Response(null, {
			status: response.status,
			headers: { ...headers, Location: location },
		});
	}
	// Provider errors can contain exchange diagnostics; don't forward arbitrary bodies.
	return new Response('OAuth callback rejected', {
		status: response.status >= 400 ? response.status : 502,
		headers,
	});
}
export default { fetch: (request: Request) => callback(request) };
