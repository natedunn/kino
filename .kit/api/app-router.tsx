import type { TRPCClientErrorLike } from '@trpc/client';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

import routes from '@/lib/api/routers';

import { t } from '.';

export const appRouter = t.router(routes);

export type AppRouter = typeof appRouter;
export type API = {
	input: inferRouterInputs<AppRouter>;
	output: inferRouterOutputs<AppRouter>;
};

export type TRPCClientError = TRPCClientErrorLike<AppRouter>;
