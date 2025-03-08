import { cache } from 'react';
import * as H from 'next/headers';
import { NextRequest } from 'next/server';

import { t } from '@/kit/api';
import { appRouter } from '@/kit/api/app-router';
import { createInnerTRPCContext } from '@/kit/api/context';
import { getAuth } from '@/kit/auth';
import { getBaseUrl, logger } from '@/kit/utils';

const createContext = cache(async () => {
	const headers = await H.headers();
	const cookies = await H.cookies();

	const baseUrl = getBaseUrl();
	const req = new NextRequest(`${baseUrl}`, { headers }) as NextRequest;

	return {
		...createInnerTRPCContext({
			auth: await getAuth(),
		}),
		req,
		headers: {
			cookie: cookies.toString(),
			'x-trpc-source': 'rsc-invoke',
		},
	};
});

const createCaller = t.createCallerFactory(appRouter);
export const api = createCaller(createContext, {
	onError: ({ error }) => {
		logger.error('Error in tRPC server invoker', error);
	},
});
