import { t } from '@/kit/api';
import { middleware } from '@/lib/api/middlewares';

export const procedure = {
	open: t.procedure.use(middleware.open),
	admin: t.procedure.use(middleware.adminGuard),
	auth: t.procedure.use(middleware.authGuard),
};
