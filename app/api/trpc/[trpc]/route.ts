import type { NextRequest } from 'next/server';

import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { appRouter } from '@/kit/api/app-router';
import { createTRPCContext } from '@/kit/api/context';
import { log } from '@/kit/utils';

const handler = (req: NextRequest) => {
	return fetchRequestHandler({
		endpoint: `/api/trpc`,
		req,
		router: appRouter,
		createContext: () => createTRPCContext({ req }),
		onError: ({ error }) => {
			log.error('Error in tRPC handler (route.ts)', '\n', '\n 🚫', error);
		},
	});
};

export { handler as GET, handler as POST };
