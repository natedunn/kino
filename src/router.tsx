import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';

import { DefaultCatchBoundary } from './components/_default-catch-boundary';
import { RoutePending } from './components/route-pending';
import {
	getAppConvexQueryClient,
	getAppQueryClient,
	hydrationConfig,
} from './lib/convex/query-client';
import { routeTree } from './routeTree.gen';

export function getRouter() {
	const queryClient = getAppQueryClient();
	const convexQueryClient = getAppConvexQueryClient(queryClient);
	const router = createRouter({
		context: {
			convexQueryClient,
			queryClient,
		},
		routeTree,
		scrollRestoration: true,
		defaultPreload: 'intent',
		defaultPreloadStaleTime: 30_000,
		// Loading order of operations: every route resolves a pending component,
		// which also wraps it in its own Suspense boundary — a suspending
		// `useSuspenseQuery` shows that route's skeleton instead of bubbling to
		// an ancestor and blanking the shell. Pending UI waits `defaultPendingMs`
		// before appearing and then stays for at least `defaultPendingMinMs`, so
		// it never flashes for a single frame.
		defaultPendingComponent: RoutePending,
		defaultPendingMs: 600,
		defaultPendingMinMs: 500,
		// Scope error handling (including transient query cancellations) to the
		// failing route so the surrounding layout and nav stay mounted.
		defaultErrorComponent: DefaultCatchBoundary,
	});

	setupRouterSsrQueryIntegration({
		dehydrateOptions: hydrationConfig.dehydrate as never,
		hydrateOptions: hydrationConfig.hydrate as never,
		queryClient: queryClient as never,
		router,
	});

	return router;
}

declare module '@tanstack/react-router' {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
