import type { RateLimiter } from '@convex-dev/rate-limiter';
import type { FunctionReference } from 'convex/server';
import type { ComponentApi as CoreApi } from '../../.upstream/packages/core/src/components/core/_generated/component.ts';
import type { ComponentApi as PasswordApi } from '../../.upstream/packages/core/src/components/password/_generated/component.ts';
import type { UserCallbacks } from '../../.upstream/packages/core/src/lib/types.ts';

import { componentsGeneric, makeFunctionReference } from 'convex/server';

export const components = componentsGeneric() as unknown as {
	auth: CoreApi & {
		public: {
			revokeUserSessions: FunctionReference<'mutation', 'public', { userId: string }, null>;
		};
	};
	password: PasswordApi;
	emailLimits: ConstructorParameters<typeof RateLimiter>[0];
};
type Callbacks = UserCallbacks<'emailPassword', { email: string }, 'users'>;
// Test fixture references: actual visibility/validators are declared on handlers.
export const callbacks: Callbacks = {
	createUser: makeFunctionReference('auth:createUser') as unknown as Callbacks['createUser'],
	onSignIn: makeFunctionReference('auth:onSignIn') as unknown as Callbacks['onSignIn'],
};
