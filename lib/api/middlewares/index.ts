import { adminMiddleware } from './admin-guard';
import { authGuardMiddleware } from './auth-guard';
import { openMiddleware } from './open';

export const middleware = {
	adminGuard: adminMiddleware,
	authGuard: authGuardMiddleware,
	open: openMiddleware,
};
