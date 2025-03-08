import type { NextRequest } from 'next/server';

import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { appRouter } from '@/kit/api/app-router';
import { createTRPCContext } from '@/kit/api/context';
import { logger } from '@/kit/utils';

const handler = (req: NextRequest) => {
	return fetchRequestHandler({
		endpoint: '/api/trpc',
		req,
		router: appRouter,
		createContext: () => createTRPCContext({ req }),
		onError: ({ error }) => {
			logger.error('Error in tRPC handler (route.ts):', error);
		},
	});
};

export { handler as GET, handler as POST };
