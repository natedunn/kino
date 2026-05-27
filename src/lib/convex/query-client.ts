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

function stableStringify(value: unknown): string {
  return JSON.stringify(sortObjectKeys(value));
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, sortObjectKeys(entry)])
  );
}

export function convexQueryKeyHashFn(queryKey: readonly unknown[]) {
  if (queryKey[0] === 'convexQuery' || queryKey[0] === 'convexAction') {
    const [, functionName, args] = queryKey;
    return `${queryKey[0]}|${String(functionName)}|${stableStringify(convexToJson(args as Value))}`;
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
  const convexQueryClient = getConvexQueryClientSingleton({
    authStore,
    convex,
    queryClient,
  });

  const options = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({
    ...options,
    queries: {
      ...options.queries,
      queryKeyHashFn: convexQueryKeyHashFn,
    },
  });

  return convexQueryClient;
}
