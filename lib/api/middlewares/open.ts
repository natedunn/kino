import { t } from '@/kit/api';

export const openMiddleware = t.middleware(async ({ ctx, next }) =>
	next({
		ctx,
	})
);
