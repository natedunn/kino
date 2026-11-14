import { setupGithub, vGithubProfile } from '@convex-dev/auth/methods/github/server';
import { ConvexError, v } from 'convex/values';

import { components, internal } from './_generated/api';
import { env, internalMutation } from './_generated/server';
import { core } from './auth';
import { ensurePersonalOrganization } from './organizations';
import { ensureProfile } from './profiles';

const methodValidator = v.object({
	name: v.literal('github'),
	profile: vGithubProfile,
});

export const createUser = internalMutation({
	args: { method: methodValidator },
	returns: v.id('users'),
	handler: async (ctx, { method }) => {
		const { profile } = method;
		if (!profile.emailVerified || !profile.email) throw new ConvexError('VERIFIED_EMAIL_REQUIRED');
		// Convex Auth 2.0 keeps GitHub accounts in the oauthGithub component, which
		// starts empty. A GitHub account that already has a Kino user gets that
		// user back (onSignIn still checks it), so no account copy is needed.
		// Never search by email to attach a GitHub identity to a password user.
		const existing = await ctx.db
			.query('users')
			.withIndex('by_githubAccountId', (q) => q.eq('githubAccountId', profile.id))
			.unique();
		if (existing) return existing._id;
		const userId = await ctx.db.insert('users', {
			status: 'active',
			systemRole: 'user',
			githubAccountId: profile.id,
			githubEmail: profile.email,
			githubEmailVerifiedAt: Date.now(),
		});
		await ensureProfile(ctx, userId, {
			name: profile.name || profile.login,
			username: profile.login,
			imageUrl: profile.avatarUrl,
		});
		await ensurePersonalOrganization(ctx, userId);
		return userId;
	},
});

export const onSignIn = internalMutation({
	args: { userId: v.id('users'), method: methodValidator },
	returns: v.null(),
	handler: async (ctx, { userId, method }) => {
		const user = await ctx.db.get('users', userId);
		const { profile } = method;
		if (!user || user.status !== 'active') throw new ConvexError('SIGN_IN_REJECTED');
		if (user.githubAccountId !== profile.id) throw new ConvexError('GITHUB_ACCOUNT_MISMATCH');
		if (!profile.emailVerified || !profile.email) throw new ConvexError('VERIFIED_EMAIL_REQUIRED');
		// Refresh verified provider evidence, but preserve the user's app profile edits.
		if (user.githubEmail !== profile.email)
			await ctx.db.patch('users', userId, {
				githubEmail: profile.email,
				githubEmailVerifiedAt: Date.now(),
			});
		await ensureProfile(ctx, userId, {
			name: profile.name || profile.login,
			username: profile.login,
			imageUrl: profile.avatarUrl,
		});
		await ensurePersonalOrganization(ctx, userId);
		return null;
	},
});

// Keep Kino's public function names; the gateway and SSR adapter call them.
export const {
	startSignInWithGithub: startSignInGithub,
	completeSignInWithGithub: completeSignInGithub,
} = setupGithub(core, {
	component: components.oauthGithub,
	allowedRedirectOrigins: [env.AUTH_APP_ORIGIN],
}).attachUserCallbacks({
	createUser: internal.github.createUser,
	onSignIn: internal.github.onSignIn,
});
