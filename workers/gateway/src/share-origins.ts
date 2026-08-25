import type { GatewayEnv } from './env';

import { isAuthorizedAdmin, normalizeQuickTunnelOrigin, shareOriginKey } from './env';

const SHARE_ORIGIN_TTL_SECONDS = 60 * 60 * 6;

type RegisteredShareOrigin = {
	origin: string;
	registeredAt: number;
};

export async function handleShareOriginsApi(env: GatewayEnv, request: Request) {
	if (env.QUICK_TUNNEL_TARGETS_ENABLED !== 'true') {
		return new Response('Not found', { status: 404 });
	}
	if (!isAuthorizedAdmin(env, request)) {
		return new Response('Unauthorized', { status: 401 });
	}
	if (request.method === 'GET') {
		return Response.json({ enabled: true });
	}
	if (request.method !== 'PUT' && request.method !== 'DELETE') {
		return new Response('Method not allowed', { status: 405 });
	}

	let origin: string | null;
	try {
		const body = await request.json();
		origin =
			typeof body === 'object' &&
			body !== null &&
			'origin' in body &&
			typeof body.origin === 'string'
				? normalizeQuickTunnelOrigin(body.origin)
				: null;
	} catch {
		origin = null;
	}
	if (!origin) {
		return new Response('Body must contain an HTTPS trycloudflare.com origin', {
			status: 400,
		});
	}

	const key = await shareOriginKey(origin);
	if (request.method === 'DELETE') {
		await env.TARGETS.delete(key);
		return Response.json({ ok: true });
	}

	const registration: RegisteredShareOrigin = {
		origin,
		registeredAt: Date.now(),
	};
	await env.TARGETS.put(key, JSON.stringify(registration), {
		expirationTtl: SHARE_ORIGIN_TTL_SECONDS,
	});
	return Response.json({ ok: true, registration });
}
