import { createServerFn } from '@tanstack/react-start';
import { getRequest, setResponseHeader } from '@tanstack/react-start/server';
import { ConvexHttpClient } from 'convex/browser';

import {
	httpCookies,
	ServerAuthSession,
	setupConvexAuthServer,
} from '../../.upstream/packages/core/src/server/index';
import { api } from '../../email/convex/_generated/api';
import { allowedOrigins, convexUrl } from './proof-config';

export const getAuthRoutes = (request: Request) =>
	setupConvexAuthServer({
		convexUrl,
		refreshSession: api.auth.refreshSession,
		signOut: api.auth.signOut,
		signIn: [api.auth.signIn, api.github.completeSignInGithub],
		allowedOrigins,
		cookieOptions: { secure: new URL(request.url).protocol === 'https:' },
	});
const pending = new WeakMap<Request, Promise<string | null>>();
export const getInitialToken = createServerFn({ method: 'GET' }).handler(async () => {
	const request = getRequest();
	let result = pending.get(request);
	if (!result) {
		result = (async () => {
			const cookies = httpCookies(request);
			const client = new ConvexHttpClient(convexUrl);
			let refreshes = 0;
			const session = new ServerAuthSession({
				cookies,
				cookieOptions: { secure: new URL(request.url).protocol === 'https:' },
				refreshSession: (token) => {
					refreshes++;
					return client.mutation(api.auth.refreshSession, { refreshToken: token });
				},
			});
			const token = await session.getToken();
			const headers = new Headers();
			cookies.applyTo(headers);
			const setCookies = headers.getSetCookie();
			if (setCookies.length) setResponseHeader('Set-Cookie', setCookies);
			setResponseHeader('Cache-Control', 'private, no-store');
			setResponseHeader('X-Proof-SSR-Refreshes', String(refreshes));
			return token;
		})();
		pending.set(request, result);
	}
	return result;
});
