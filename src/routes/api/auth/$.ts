import { createFileRoute } from '@tanstack/react-router';

import { handleAuthRequest } from '@/lib/auth/auth-server';

// @ts-ignore routeTree.gen.ts is refreshed by TanStack Router during dev/build.
export const Route = createFileRoute('/api/auth/$')({
	server: {
		handlers: {
			GET: async ({ request }) => handleAuthRequest(request),
			POST: async ({ request }) => handleAuthRequest(request),
		},
	},
});
