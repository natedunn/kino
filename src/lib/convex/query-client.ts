import type { DefaultOptions } from '@tanstack/react-query';
import type { Value } from 'convex/values';
import type { AuthStore } from 'kitcn/react';

import {
	defaultShouldDehydrateQuery,
	hashKey,
	MutationCache,
	QueryCache,
	QueryClient,
} from '@tanstack/react-query';
import { convexToJson } from 'convex/values';
import { isCRPCClientError, isCRPCError } from 'kitcn/crpc';
import {
	ConvexReactClient,
	getConvexQueryClientSingleton,
	getQueryClientSingleton,
} from 'kitcn/react';
import SuperJSON from 'superjson';

import { captureAppError } from '@/lib/posthog';

export const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

export const hydrationConfig: Pick<DefaultOptions, 'dehydrate' | 'hydrate'> = {
	dehydrate: {
		serializeData: SuperJSON.serialize,
		shouldDehydrateQuery: (query) => {
			if (defaultShouldDehydrateQuery(query)) return true;
			// Stream still-`pending` queries during SSR EXCEPT Convex ones. A pending
			// query is emitted as a deferred chunk, which holds the streaming HTML
			// document response open until it settles. Convex `useQuery` subscriptions
			// and the feedback loaders' fire-and-forget `void prefetchQuery(...)` warm-ups
			// are intentionally non-blocking, but streaming them keeps the browser tab's
			// load indicator spinning after the page has painted — and against a cold
			// local Convex backend they can take ~1s+ to settle. Let them resolve
			// client-side instead so the document response can close promptly.
			if (query.state.status === 'pending') {
				const key = query.queryKey[0];
				return key !== 'convexQuery' && key !== 'convexAction';
			}
			return false;
		},
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

export function convexQueryKeyHashFn(queryKey: ReadonlyArray<unknown>) {
	if (queryKey[0] === 'convexQuery' || queryKey[0] === 'convexAction') {
		const [, functionName, args] = queryKey;
		return `${queryKey[0]}|${String(functionName)}|${stableStringify(convexToJson(args as Value))}`;
	}

	return hashKey(queryKey);
}

function safeOperationName(operationKey: ReadonlyArray<unknown> | undefined) {
	if (!operationKey?.length) return undefined;

	const [kind, functionName] = operationKey;

	if (
		(kind === 'convexQuery' || kind === 'convexAction' || kind === 'convexMutation') &&
		functionName
	) {
		return `${String(kind)}:${String(functionName)}`;
	}

	return String(kind);
}

function captureTanStackError(error: unknown, properties: Record<string, unknown>) {
	const crpcProperties = isCRPCClientError(error)
		? {
				crpcCode: error.code,
				crpcFunctionName: error.functionName,
				source: 'crpc',
			}
		: {
				source: 'tanstack-query',
			};

	captureAppError(error, {
		...crpcProperties,
		...properties,
	});
}

export function createQueryClient() {
	return new QueryClient({
		mutationCache: new MutationCache({
			onError: (error, _variables, _context, mutation) => {
				captureTanStackError(error, {
					operationName: safeOperationName(mutation.options.mutationKey),
					tanstackOperation: 'mutation',
				});
			},
		}),
		queryCache: new QueryCache({
			onError: (error, query) => {
				captureTanStackError(error, {
					operationName: safeOperationName(query.queryKey),
					tanstackOperation: 'query',
				});
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

export function getAppConvexQueryClient(queryClient: QueryClient, authStore?: AuthStore) {
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
