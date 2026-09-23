import { createFileRoute } from '@tanstack/react-router';

import { getAuthRoutes } from '../../../auth-server';
import { completeGithub, startGithub } from '../../../github-server';
import { allowedOrigins } from '../../../proof-config';

export const Route = createFileRoute('/api/auth/$')({
	server: {
		handlers: {
			GET: async ({ request }) =>
				new URL(request.url).pathname === '/api/auth/github/callback'
					? completeGithub(request)
					: new Response('Not found', { status: 404 }),
			POST: async ({ request }) => {
				const path = new URL(request.url).pathname;
				if (path === '/api/auth/github/start') return startGithub(request);
				const origin = request.headers.get('origin');

				if (
					!origin ||
					!allowedOrigins.includes(origin) ||
					new URL(origin).protocol !== new URL(request.url).protocol
				)
					return new Response('Forbidden', { status: 403 });
				const authRoutes = getAuthRoutes(request);
				const handler =
					path === '/api/auth/signin'
						? authRoutes.convexProxyHandler
						: path === '/api/auth/refresh'
							? authRoutes.refreshHandler
							: path === '/api/auth/signout'
								? authRoutes.signOutHandler
								: null;
				if (!handler) return new Response('Not found', { status: 404 });
				const response = await handler(request);
				response.headers.set('Cache-Control', 'private, no-store');
				return response;
			},
		},
	},
});
