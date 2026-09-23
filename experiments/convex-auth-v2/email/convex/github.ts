import { ConvexError, v } from 'convex/values';

import { setupCore } from '../../.revocation/packages/core/src/components/core/setup';
import {
	setupGithub,
	vGithubProfile,
} from '../../.revocation/packages/core/src/oauth/component/github';
import { components, internal } from './_generated/api';
import { internalMutation } from './_generated/server';

export const createUser = internalMutation({
	args: {
		provider: v.object({
			name: v.literal('github'),
			accountId: v.string(),
			profile: vGithubProfile,
		}),
	},
	returns: v.id('users'),
	handler: async (ctx, { provider }) => {
		if (!provider.profile.emailVerified || !provider.profile.email)
			throw new ConvexError('VERIFIED_EMAIL_REQUIRED');
		// Keep OAuth identity separate from password email lookup; no implicit linking.
		return ctx.db.insert('users', {
			githubId: provider.profile.id,
			githubEmail: provider.profile.email,
			githubEmailVerified: true,
			verified: true,
			verificationGeneration: 0,
			resetGeneration: 0,
		});
	},
});
export const onSignIn = internalMutation({
	args: {
		userId: v.id('users'),
		provider: v.object({
			name: v.literal('github'),
			accountId: v.string(),
			profile: vGithubProfile,
		}),
	},
	returns: v.null(),
	handler: async (ctx, { userId, provider }) => {
		const user = await ctx.db.get(userId);
		if (
			!user ||
			user.githubId !== provider.profile.id ||
			provider.accountId !== provider.profile.id
		)
			throw new ConvexError('GITHUB_ACCOUNT_MISMATCH');
		if (!provider.profile.emailVerified || !provider.profile.email)
			throw new ConvexError('VERIFIED_EMAIL_REQUIRED');
		await ctx.db.patch(userId, { githubEmail: provider.profile.email, githubEmailVerified: true });
		return null;
	},
});
const core = setupCore({ component: components.auth });
export const { startSignInGithub, completeSignInGithub } = setupGithub(core, {
	component: components.oauthGithub,
	allowedRedirectOrigins: ['https://127.0.0.1:5183'],
}).attachUserCallbacks({
	createUser: internal.github.createUser,
	onSignIn: internal.github.onSignIn,
});
