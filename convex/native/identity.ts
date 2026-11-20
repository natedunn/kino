import type { Doc } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';

import { env } from './_generated/server';

type IdentityCtx = Pick<QueryCtx, 'auth' | 'db' | 'runQuery'>;

// The access token names a session; getAuthUserId resolves it to the session's
// user and returns null once the session is signed out, revoked or expired.
export async function getCurrentUser(ctx: IdentityCtx) {
	const userId = await getAuthUserId(ctx);
	if (!userId) return null;
	const user = await ctx.db.get('users', userId);
	return user?.status === 'active' ? user : null;
}

export async function requireCurrentUser(ctx: IdentityCtx) {
	const user = await getCurrentUser(ctx);
	if (!user) throw new ConvexError('UNAUTHORIZED');
	return user;
}

// This grants only the reserved project-slug exception, never a system role.
export function canUseReservedProjectSlugs(user: Doc<'users'> | null) {
	const adminEmail = env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
	if (!adminEmail || user?.status !== 'active') return false;
	return (
		(user.passwordEmailVerifiedAt !== undefined &&
			user.passwordEmail?.trim().toLowerCase() === adminEmail) ||
		(user.githubEmailVerifiedAt !== undefined &&
			user.githubEmail?.trim().toLowerCase() === adminEmail)
	);
}
