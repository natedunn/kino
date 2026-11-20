import { setupConvexAuth } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { components } from './_generated/api';
import { query } from './_generated/server';
import { getCurrentUser } from './identity';

export const core = setupConvexAuth({ component: components.auth, usersTable: 'users' });
export const { refreshSession, signOut } = core;

// The upstream predicate only checks for any verified JWT. Kino also requires
// a live, active app user from this deployment before SSR reports signed-in.
export const isAuthenticated = query({
	args: {},
	returns: v.boolean(),
	handler: async (ctx) => (await getCurrentUser(ctx)) !== null,
});
