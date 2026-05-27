import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { createRouter } from '@tanstack/react-router';
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
    defaultPreloadStaleTime: 0,
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
