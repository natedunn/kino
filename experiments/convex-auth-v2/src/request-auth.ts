import type { RefreshSession } from '@proof/auth-server';

import { httpCookies, ServerAuthSession } from '@proof/auth-server';

/** Request-scoped candidate for Start middleware. Not installed into Kino. */
export function createRequestAuth(request: Request, refreshSession: RefreshSession) {
	const cookies = httpCookies(request);
	const session = new ServerAuthSession({
		cookies,
		refreshSession,
		cookieOptions: { secure: new URL(request.url).protocol === 'https:' },
	});
	// Parallel route loaders must share one refresh within an SSR request.
	let token: Promise<string | null> | undefined;
	return {
		// Token availability is NOT a verified authentication/authorization verdict.
		// Pass this token to Convex; protected functions must enforce access there.
		getToken: () => (token ??= session.getToken()),
		finish(response: Response) {
			const headers = new Headers(response.headers);
			cookies.applyTo(headers);
			headers.set('Cache-Control', 'private, no-store');
			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers,
			});
		},
	};
}
