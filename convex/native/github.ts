import { setupGithub, vGithubProfile } from '@convex-dev/auth/providers/oauth/github';
import { ConvexError, v } from 'convex/values';

import { components, internal } from './_generated/api';
import { env, internalMutation } from './_generated/server';
import { core } from './auth';
import { ensurePersonalOrganization } from './organizations';
import { ensureProfile } from './profiles';

const providerValidator = v.object({
	name: v.literal('github'),
	accountId: v.string(),
	profile: vGithubProfile,
});

export const createUser = internalMutation({
	args: { provider: providerValidator },
	returns: v.id('users'),
	handler: async (ctx, { provider }) => {
		const { profile } = provider;
		if (provider.accountId !== profile.id) throw new ConvexError('GITHUB_ACCOUNT_MISMATCH');
		if (!profile.emailVerified || !profile.email) throw new ConvexError('VERIFIED_EMAIL_REQUIRED');
		// Never search by email to attach a GitHub identity to a password user.
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
	args: { userId: v.id('users'), provider: providerValidator },
	returns: v.null(),
	handler: async (ctx, { userId, provider }) => {
		const user = await ctx.db.get('users', userId);
		const { profile } = provider;
		if (!user || user.status !== 'active') throw new ConvexError('SIGN_IN_REJECTED');
		if (user.githubAccountId !== profile.id || provider.accountId !== profile.id)
			throw new ConvexError('GITHUB_ACCOUNT_MISMATCH');
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

export const { startSignInGithub, completeSignInGithub } = setupGithub(core, {
	component: components.oauthGithub,
	allowedRedirectOrigins: [env.AUTH_APP_ORIGIN],
}).attachUserCallbacks({
	createUser: internal.github.createUser,
	onSignIn: internal.github.onSignIn,
});
