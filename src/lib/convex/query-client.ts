import type { DefaultOptions } from '@tanstack/react-query';
import type { Value } from 'convex/values';

import { ConvexQueryClient } from '@convex-dev/react-query';
import {
	defaultShouldDehydrateQuery,
	hashKey,
	MutationCache,
	QueryCache,
	QueryClient,
} from '@tanstack/react-query';
import { convexToJson } from 'convex/values';
import SuperJSON from 'superjson';

import { captureAppError } from '@/lib/posthog';

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
	captureAppError(error, {
		source: 'tanstack-query',
		...properties,
	});
}

export function createQueryClient(convexQueryClient?: ConvexQueryClient) {
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
				...(convexQueryClient ? { queryFn: convexQueryClient.queryFn() } : {}),
				// Convex subscriptions keep cached data live, so aggressive garbage
				// collection only forces a re-suspension (skeleton) when navigating
				// back after idling past the default 5-minute gcTime.
				gcTime: 30 * 60 * 1000,
				queryKeyHashFn: convexQueryKeyHashFn,
				retry: (failureCount) => failureCount < 3,
			},
		},
	});
}

let browserQueryClient: QueryClient | undefined;
const convexClients = new WeakMap<QueryClient, ConvexQueryClient>();

export function getAppQueryClient() {
	if (typeof window === 'undefined') return createQueryClient();
	return (browserQueryClient ??= createQueryClient());
}

export function getAppConvexQueryClient(queryClient: QueryClient) {
	const existing = convexClients.get(queryClient);
	if (existing) return existing;

	const convexQueryClient = new ConvexQueryClient(import.meta.env.VITE_CONVEX_URL, {
		// Start already supplied a server-validated access token during SSR. Convex
		// otherwise rotates the refresh cookie immediately after confirming that
		// cached token on every document navigation, increasing refresh races.
		initialAuthTokenReuse: true,
	});

	const options = queryClient.getDefaultOptions();
	queryClient.setDefaultOptions({
		...options,
		queries: {
			...options.queries,
			queryFn: convexQueryClient.queryFn(),
			queryKeyHashFn: convexQueryKeyHashFn,
		},
	});
	convexQueryClient.connect(queryClient);
	convexClients.set(queryClient, convexQueryClient);

	return convexQueryClient;
}
