import { ConvexQueryClient } from '@convex-dev/react-query';
import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';

import { convexUrl } from './proof-config';
import { routeTree } from './routeTree.gen';

export function getRouter() {
	// Protected documents must not replace their SSR snapshot with a pre-auth query result.
	const protectedDocument =
		typeof window !== 'undefined' &&
		/^\/(?:private\/|org\/|organizations(?:\/|$))/.test(window.location.pathname);
	const convex = new ConvexQueryClient(convexUrl, { expectAuth: protectedDocument });
	const query = new QueryClient({
		defaultOptions: {
			queries: { queryKeyHashFn: convex.hashFn(), queryFn: convex.queryFn(), retry: false },
		},
	});
	convex.connect(query);
	const router = createRouter({
		routeTree,
		context: { convex, query },
		defaultPreload: 'intent',
		defaultPreloadStaleTime: 30_000,
		defaultPendingMs: 150,
	});
	setupRouterSsrQueryIntegration({
		router,
		queryClient: query,
		dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' },
	});
	return router;
}
declare module '@tanstack/react-router' {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
