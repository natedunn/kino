import type { AuthFunctions, GenericCtx } from '@convex-dev/better-auth';

import { createClient } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { betterAuth } from 'better-auth';
import { admin, organization, username } from 'better-auth/plugins';
import { adjectives, nouns, uniqueUsernameGenerator } from 'unique-username-generator';

import { components, internal } from './_generated/api';
import { DataModel, Id } from './_generated/dataModel';
import authSchema from './betterAuth/schema';

const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel, typeof authSchema>(components.betterAuth, {
	authFunctions,
	local: {
		schema: authSchema,
	},
	verbose: false,
	triggers: {
		user: {
			onCreate: async (ctx, newUser) => {
				const generatedUsername = uniqueUsernameGenerator({
					length: 30,
					separator: '',
					style: 'snakeCase',
					dictionaries: [adjectives, nouns],
					randomDigits: 3,
				});

				const auth = createAuth(ctx);
				const username = (newUser.username ?? generatedUsername).toLowerCase();

				await auth.api.createOrganization({
					body: {
						slug: username,
						name: newUser.name,
						userId: newUser._id,
					},
				});

				const profileId = await ctx.db.insert('profile', {
					imageUrl: newUser.image ?? undefined,
					userId: newUser._id,
				});

				// Directly updating the column prevents onChange from running below
				await ctx.runMutation(components.betterAuth.user.updateUsername, {
					username: username,
					authId: newUser._id,
				});

				await authComponent.setUserId(ctx, newUser._id, profileId);
			},
			onDelete: async (ctx, user) => {
				const profileId = user.userId as Id<'profile'>;
				await ctx.db.delete(profileId);
			},
			onUpdate: async (ctx, oldUser, newUser) => {
				if (oldUser._id !== newUser._id) {
					throw new Error('ID MISMATCH!');
				}

				const profileId = newUser.userId as Id<'profile'>;

				if (!profileId) {
					console.error('Nothing to update: no userId found');

					await ctx.db.get(profileId);

					await ctx.db.patch(profileId, {
						imageUrl: newUser.image ?? undefined,
					});
				}
			},
		},
	},
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export const createAuth = (ctx: GenericCtx<DataModel>) => {
	return betterAuth({
		baseURL: process.env.SITE_URL!,
		trustedOrigins: ['http://localhost:3000', 'https://usekino.com'],
		database: authComponent.adapter(ctx),
		logger: {
			disabled: true,
		},
		account: {
			accountLinking: {
				enabled: true,
			},
		},
		user: {
			additionalFields: {
				imageKey: {
					type: 'string',
					required: false,
				},
			},
			deleteUser: {
				enabled: true,
			},
		},
		socialProviders: {
			github: {
				clientId: process.env.GITHUB_CLIENT_ID as string,
				clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
			},
		},
		plugins: [
			username({
				minUsernameLength: 3,
				maxUsernameLength: 39,
			}),
			admin(),
			organization(),
			convex(),
		],
	});
};
