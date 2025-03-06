import { TRPCError } from '@trpc/server';

import { t } from '@/kit/api';

export const authGuardMiddleware = t.middleware(async ({ ctx, next }) => {
	const { session, user } = ctx.auth;

	if (!session || !user) {
		throw new TRPCError({
			code: 'UNAUTHORIZED',
			message: 'Not authenticated',
		});
	}

	return next({
		ctx: {
			...ctx,
			auth: {
				session,
				user,
			},
		},
	});
});
