import type { GatewayEnv } from './env';
import type { Routes } from './native-routing';

import { REFERENCE_PATTERN, newReference, referenceName } from './native-opaque-state';
import { resolveRoute } from './native-routing';

const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };

export async function handleNativeOAuth(
	request: Request,
	env: GatewayEnv,
	routes: Routes,
	send: typeof fetch = fetch
): Promise<Response> {
	if (!env.OAUTH_STATES) return new Response('State storage not configured', { status: 503, headers });
	const store = env.OAUTH_STATES;
	const url = new URL(request.url);
	if (url.pathname === '/oauth/state') {
		if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers });
		try {
			const reader = request.body?.getReader();
			if (!reader) throw new Error();
			const chunks: Array<Uint8Array> = [];
			let size = 0;
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				size += value.byteLength;
				if (size > 4096) {
					await reader.cancel();
					return new Response('Request too large', { status: 413, headers });
				}
				chunks.push(value);
			}
			const bytes = new Uint8Array(size);
			let offset = 0;
			for (const chunk of chunks) {
				bytes.set(chunk, offset);
				offset += chunk.byteLength;
			}
			const { envelope } = JSON.parse(new TextDecoder().decode(bytes));
			if (typeof envelope !== 'string' || envelope.length > 2048) throw new Error();
			await resolveRoute(envelope, routes);
			const state = newReference();
			const object = store.get(store.idFromName(await referenceName(state)));
			if (!(await object.create(envelope))) throw new Error();
			return Response.json({ state }, { headers });
		} catch {
			return new Response('Invalid state registration', { status: 400, headers });
		}
	}
	if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers });
	const state = url.searchParams.get('state');
	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');
	if (
		url.search.length > 4096 || !state || !REFERENCE_PATTERN.test(state) ||
		(!code && !error) || (code && error) ||
		['state', 'code', 'error'].some((key) => url.searchParams.getAll(key).length > 1)
	) return new Response('Invalid callback', { status: 400, headers });
	let resolved: Awaited<ReturnType<typeof resolveRoute>>;
	try {
		const object = store.get(store.idFromName(await referenceName(state)));
		const envelope = await object.consume();
		if (!envelope) throw new Error();
		resolved = await resolveRoute(envelope, routes);
	} catch {
		return new Response('Invalid routing state', { status: 400, headers });
	}
	const target = new URL(resolved.route.backendCallback);
	for (const key of ['code', 'error', 'error_description']) {
		const value = url.searchParams.get(key);
		if (value) target.searchParams.set(key, value);
	}
	target.searchParams.set('state', resolved.state);
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
		const allowed = new URL(resolved.route.appCallback);
		if (destination.username || destination.password || destination.origin !== allowed.origin ||
			destination.pathname !== allowed.pathname || destination.hash)
			return new Response('Untrusted callback destination', { status: 502, headers });
		return new Response(null, { status: response.status, headers: { ...headers, Location: location } });
	}
	return new Response('OAuth callback rejected', {
		status: response.status >= 400 ? response.status : 502,
		headers,
	});
}
