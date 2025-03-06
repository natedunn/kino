import type { NextRequest } from 'next/server';

import { getAuth } from '../auth';

type CreateContextOptions = {
	auth: Awaited<ReturnType<typeof getAuth>>;
};

export const createInnerTRPCContext = (opts: CreateContextOptions) => {
	return {
		auth: opts.auth,
	};
};

export const createTRPCContext = async (opts: { req: NextRequest }) => {
	return {
		...createInnerTRPCContext({
			auth: await getAuth(opts.req.headers),
		}),
		req: opts.req,
		headers: opts && Object.fromEntries(opts.req.headers),
	};
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
