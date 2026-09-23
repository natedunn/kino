// Server-only routing envelopes. The registry, never the browser, owns URLs.
import { jwtVerify, SignJWT } from 'jose';

export type Route = { backendCallback: string; appCallback: string; secret: string };
export type Routes = Record<string, Route>;
const audience = 'kino-convex-v2-github-gateway';
const key = (secret: string) => {
	if (secret.length < 32) throw new Error('Routing key must be at least 32 characters');
	return new TextEncoder().encode(secret);
};
function validateRoute(route: Route) {
	for (const [value, path] of [
		[route.backendCallback, '/oauth/github/callback'],
		[route.appCallback, '/api/auth/github/callback'],
	]) {
		const url = new URL(value);
		if (
			url.protocol !== 'https:' ||
			url.username ||
			url.password ||
			url.search ||
			url.hash ||
			url.pathname !== path
		)
			throw new Error('Routing requires exact HTTPS callback URLs');
	}
}
export async function signRoute(
	id: string,
	state: string,
	secret: string,
	now = Math.floor(Date.now() / 1000)
) {
	if (!/^[a-z0-9-]{1,64}$/.test(id) || state.length < 20 || state.length > 256)
		throw new Error('Invalid routing state');
	return new SignJWT({ state })
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT', kid: id })
		.setIssuer(id)
		.setAudience(audience)
		.setIssuedAt(now)
		.setExpirationTime(now + 600)
		.sign(key(secret));
}
export async function resolveRoute(envelope: string, routes: Routes, now = new Date()) {
	const { payload, protectedHeader } = await jwtVerify(
		envelope,
		(header) => {
			if (typeof header.kid !== 'string' || !Object.hasOwn(routes, header.kid))
				throw new Error('Unknown route');
			return key(routes[header.kid].secret);
		},
		{
			algorithms: ['HS256'],
			typ: 'JWT',
			audience,
			currentDate: now,
			maxTokenAge: '10m',
			requiredClaims: ['exp', 'iat', 'iss'],
		}
	);
	const id = protectedHeader.kid!;
	if (
		payload.iss !== id ||
		typeof payload.state !== 'string' ||
		payload.state.length < 20 ||
		payload.state.length > 256 ||
		typeof payload.iat !== 'number' ||
		typeof payload.exp !== 'number' ||
		payload.exp > payload.iat + 600
	)
		throw new Error('Invalid routing claims');
	const route = routes[id];
	validateRoute(route);
	return { route, state: payload.state };
}
