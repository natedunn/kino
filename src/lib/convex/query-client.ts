import {
  type DefaultOptions,
  defaultShouldDehydrateQuery,
  hashKey,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import { isCRPCClientError, isCRPCError } from 'kitcn/crpc';
import {
  ConvexReactClient,
  getConvexQueryClientSingleton,
  getQueryClientSingleton,
  type AuthStore,
} from 'kitcn/react';
import { type Value, convexToJson } from 'convex/values';
import SuperJSON from 'superjson';

export const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL!);

export const hydrationConfig: Pick<DefaultOptions, 'dehydrate' | 'hydrate'> = {
  dehydrate: {
    serializeData: SuperJSON.serialize,
    shouldDehydrateQuery: (query) =>
      defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
    shouldRedactErrors: () => false,
  },
  hydrate: {
    deserializeData: SuperJSON.deserialize,
  },
};

function convexQueryKeyHashFn(queryKey: readonly unknown[]) {
  if (queryKey[0] === 'convexQuery' || queryKey[0] === 'convexAction') {
    const [, functionName, args] = queryKey;
    return `${queryKey[0]}|${String(functionName)}|${JSON.stringify(convexToJson(args as Value))}`;
  }

  return hashKey(queryKey);
}

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (isCRPCClientError(error)) {
          console.warn(`[CRPC] ${error.code}:`, error.functionName);
        }
      },
    }),
    defaultOptions: {
      ...hydrationConfig,
      queries: {
        queryKeyHashFn: convexQueryKeyHashFn,
        retry: (failureCount, error) => {
          if (isCRPCError(error)) return false;
          return failureCount < 3;
        },
      },
    },
  });
}

export function getAppQueryClient() {
  return getQueryClientSingleton(createQueryClient);
}

export function getAppConvexQueryClient(
  queryClient: QueryClient,
  authStore?: AuthStore
) {
  return getConvexQueryClientSingleton({
    authStore,
    convex,
    queryClient,
  });
}
