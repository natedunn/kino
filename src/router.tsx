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

	// Restored SSR queries subscribe as soon as the query cache hydrates, long
	// before the auth provider settles and calls setAuth. Hand the browser's
	// Convex client the server-validated session token first, so those queries
	// never run anonymously and overwrite signed-in SSR data (hydration
	// mismatches, UNAUTHORIZED). The auth provider later swaps in refreshable
	// auth. Runs before the query integration, which wraps these hooks.
	router.options.dehydrate = () => {
		const root = router.state.matches.find((match) => match.routeId === '__root__');
		const token = (root?.loaderData as { loaderToken?: string | null } | undefined)?.loaderToken;
		return { convexAuthToken: token ?? null };
	};
	router.options.hydrate = (dehydrated: { convexAuthToken?: string | null }) => {
		const token = dehydrated.convexAuthToken;
		if (token)
			convexQueryClient.convexClient.setAuth(({ forceRefreshToken }) =>
				Promise.resolve(forceRefreshToken ? null : token)
			);
	};

	setupRouterSsrQueryIntegration({
		dehydrateOptions: hydrationConfig.dehydrate,
		// The integration currently exposes the core hydrate shape through a
		// narrower adapter type; both packages consume the same runtime fields.
		hydrateOptions: hydrationConfig.hydrate as never,
		queryClient,
		router,
	});

	return router;
}

declare module '@tanstack/react-router' {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
