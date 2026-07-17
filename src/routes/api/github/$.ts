import { createFileRoute } from '@tanstack/react-router';

import { handler } from '@/lib/convex/github-server';

// @ts-ignore routeTree.gen.ts is refreshed by TanStack Router during dev/build.
export const Route = createFileRoute('/api/github/$')({
	server: {
		handlers: {
			GET: async ({ request }) => handler(request),
			POST: async ({ request }) => handler(request),
		},
	},
});
