import type { Doc } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

import { ConvexError } from 'convex/values';

import { env } from './_generated/server';

export async function getCurrentUser(ctx: Pick<QueryCtx, 'auth' | 'db'>) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity || identity.issuer !== env.CONVEX_SITE_URL) return null;
	const userId = ctx.db.normalizeId('users', identity.subject);
	if (!userId) return null;
	const user = await ctx.db.get('users', userId);
	return user?.status === 'active' ? user : null;
}

export async function requireCurrentUser(ctx: Pick<QueryCtx, 'auth' | 'db'>) {
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
