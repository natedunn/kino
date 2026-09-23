import { ConvexHttpClient } from 'convex/browser';
import { parse, serialize } from 'cookie';

import { api } from '../../email/convex/_generated/api';
import { AUTHORIZATION_URL_BUDGET, REFERENCE_PATTERN } from '../../gateway/opaque-state';
import { signRoute } from '../../gateway/routing';
import { getAuthRoutes } from './auth-server';
import { appOrigin, convexUrl, routeId } from './proof-config';

const ORIGIN = appOrigin;
const STATE = 'proofGithubState';
const options = {
	httpOnly: true,
	secure: true,
	sameSite: 'lax' as const,
	path: '/api/auth/github',
};
function end(location: string, status = 303) {
	const response = new Response(null, {
		status,
		headers: { Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
	});
	response.headers.append('Set-Cookie', serialize(STATE, '', { ...options, maxAge: 0 }));
	return response;
}
export async function startGithub(request: Request) {
	if (request.headers.get('origin') !== ORIGIN) return new Response('Forbidden', { status: 403 });
	const client = new ConvexHttpClient(convexUrl);
	const flow = await client.mutation(api.github.startSignInGithub, {
		redirectTo: ORIGIN + '/api/auth/github/callback',
	});
	const redirect = new URL(flow.redirect);
	if (routeId) {
		const secret = process.env.PROOF_ROUTING_SECRET;
		if (!secret) throw new Error('Missing proof routing key');
		const originalState = redirect.searchParams.get('state');
		if (!originalState) throw new Error('Missing provider state');
		const gateway = new URL(redirect.searchParams.get('redirect_uri')!);
		if (
			gateway.origin !== 'https://kino-v2-gateway-proof-c318c09d.hello-fc8.workers.dev' ||
			gateway.pathname !== '/oauth/github/callback'
		)
			throw new Error('Unexpected proof gateway');
		const envelope = await signRoute(routeId, originalState, secret);
		const registered = await fetch(new URL('/oauth/state', gateway).href, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ envelope }),
			redirect: 'manual',
			signal: AbortSignal.timeout(10000),
		});
		if (!registered.ok) throw new Error('State registration failed');
		const { state } = (await registered.json()) as { state: string };
		if (typeof state !== 'string' || !REFERENCE_PATTERN.test(state))
			throw new Error('Invalid state reference');
		redirect.searchParams.set('state', state);
	}
	if (new TextEncoder().encode(redirect.href).length > AUTHORIZATION_URL_BUDGET)
		throw new Error('Authorization URL exceeds proof budget');
	const response = Response.json(
		{ redirect: redirect.href },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
	response.headers.append('Set-Cookie', serialize(STATE, flow.state, { ...options, maxAge: 600 }));
	return response;
}
export async function completeGithub(request: Request) {
	const url = new URL(request.url);
	const state = parse(request.headers.get('cookie') || '')[STATE];
	const code = url.searchParams.get('convexAuthCode');
	const error = url.searchParams.get('convexAuthError');
	if (!state || !code || error)
		return end(
			ORIGIN +
				'/?oauthError=' +
				encodeURIComponent(error === 'access_denied' ? 'access_denied' : 'invalid_flow')
		);
	const proxyRequest = new Request(ORIGIN + '/api/auth/signin?path=/api/mutation', {
		method: 'POST',
		headers: { Origin: ORIGIN, Host: new URL(ORIGIN).host, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			path: 'github:completeSignInGithub',
			format: 'convex_encoded_json',
			args: [{ code, state }],
		}),
	});
	const proxy = await getAuthRoutes(proxyRequest).convexProxyHandler(proxyRequest);
	const result = await proxy.json();
	if (!proxy.ok || result.status !== 'success' || result.value?.status !== 'complete')
		return end(ORIGIN + '/?oauthError=invalid_flow');
	const response = end(ORIGIN + '/private/alpha#session-changed');
	for (const cookie of proxy.headers.getSetCookie()) response.headers.append('Set-Cookie', cookie);
	return response;
}
