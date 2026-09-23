import type { StateStore } from './opaque-state';
import type { Routes } from './routing';

import { newReference, referenceName } from './opaque-state';
import { resolveRoute } from './routing';
import { callback } from './worker';

const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
export default {
	async fetch(request: Request, env: { PROOF_ROUTES?: string; OAUTH_STATES?: StateStore }) {
		if (!env.PROOF_ROUTES)
			return new Response('Proof routing not configured', { status: 503, headers });
		let routes: Routes;
		try {
			routes = JSON.parse(env.PROOF_ROUTES);
		} catch {
			return new Response('Invalid proof configuration', { status: 503, headers });
		}
		const url = new URL(request.url);
		if (url.pathname === '/health')
			return Response.json(
				{ ok: true, protocol: 'opaque-state-v1', storage: !!env.OAUTH_STATES },
				{ headers }
			);
		if (!env.OAUTH_STATES)
			return new Response('State storage not configured', { status: 503, headers });
		const store = env.OAUTH_STATES;
		if (url.pathname === '/oauth/state') {
			if (request.method !== 'POST')
				return new Response('Method not allowed', { status: 405, headers });
			// Called server-to-server; authenticate via the per-preview signed envelope.
			try {
				const reader = request.body?.getReader();
				if (!reader) throw new Error();
				const chunks: Uint8Array[] = [];
				let size = 0;
				while (true) {
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
				const text = new TextDecoder().decode(bytes);
				const { envelope } = JSON.parse(text);
				if (typeof envelope !== 'string' || envelope.length > 2048) throw new Error();
				await resolveRoute(envelope, routes);
				const state = newReference();
				if (!(await store.getByName(await referenceName(state)).create(envelope)))
					throw new Error();
				return Response.json({ state }, { headers });
			} catch {
				return new Response('Invalid state registration', { status: 400, headers });
			}
		}
		return callback(request, fetch, routes, async (reference) => {
			const envelope = await store.getByName(await referenceName(reference)).consume();
			if (!envelope) throw new Error('Expired or consumed state');
			// Revalidate expiry and current route keys/allowlist after atomic consumption.
			return resolveRoute(envelope, routes);
		});
	},
};
