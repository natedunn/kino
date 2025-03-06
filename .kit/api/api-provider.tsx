'use client';

import type { AppRouter } from '@/kit/api/app-router';
import type { QueryClient } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
	createTRPCClient,
	httpBatchLink,
	unstable_httpBatchStreamLink as httpBatchStreamLink,
	splitLink,
} from '@trpc/client';
import superjson from 'superjson';

import { makeQueryClient, TRPCProvider } from '@/kit/api/fetcher/client';
import { customLoggerLink, skipStream } from '@/kit/api/utils';
import { getBaseUrl } from '@/kit/utils';

type ClientProviderProps = PropsWithChildren<{
	headers: Headers;
}>;

let browserQueryClient: QueryClient | undefined = undefined;

const getQueryClient = () => {
	if (typeof window === 'undefined') {
		// Server: always make a new query client
		return makeQueryClient();
	} else {
		// Browser: make a new query client if we don't already have one
		if (!browserQueryClient) browserQueryClient = makeQueryClient();
		return browserQueryClient;
	}
};

export function ApiProvider(props: ClientProviderProps) {
	const queryClient = getQueryClient();

	const options = {
		transformer: superjson,
		url: `${getBaseUrl({
			relativePath: false,
		})}/api/trpc`,
		headers() {
			const headers = new Map(props.headers);
			headers.set('x-trpc-source', 'nextjs-react');
			return Object.fromEntries(headers);
		},
	};

	const [trpcClient] = useState(() => {
		return createTRPCClient<AppRouter>({
			links: [
				customLoggerLink(),
				splitLink({
					condition: skipStream,
					true: httpBatchLink(options),
					false: httpBatchStreamLink(options),
				}),
			],
		});
	});

	return (
		<QueryClientProvider client={queryClient}>
			<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
				{props.children}
				<ReactQueryDevtools initialIsOpen={false} buttonPosition='bottom-left' />
			</TRPCProvider>
		</QueryClientProvider>
	);
}
