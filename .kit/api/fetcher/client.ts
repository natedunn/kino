import type { AppRouter } from '@/kit/api/app-router';

import { defaultShouldDehydrateQuery, QueryClient } from '@tanstack/react-query';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import superjson from 'superjson';

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 30 * 1000,
			},
			dehydrate: {
				serializeData: superjson.serialize,
				shouldDehydrateQuery: (query) =>
					defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
			},
			hydrate: {
				deserializeData: superjson.deserialize,
			},
		},
	});
}
