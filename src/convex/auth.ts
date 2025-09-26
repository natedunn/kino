import type { AuthFunctions, GenericCtx } from '@convex-dev/better-auth';

import { createClient } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { betterAuth } from 'better-auth';
import { admin, organization, username } from 'better-auth/plugins';
import { adjectives, nouns, uniqueUsernameGenerator } from 'unique-username-generator';

import { api, components, internal } from './_generated/api';
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

				const appUserId = await ctx.db.insert('user', {});

				await ctx.runMutation(api.user.onCreate, {
					authId: newUser._id,
					username: newUser.username ?? generatedUsername,
					name: newUser.name,
				});

				await authComponent.setUserId(ctx, newUser._id, appUserId);
			},
			onDelete: async (ctx, user) => {
				await ctx.db.delete(user.userId as Id<'user'>);
			},
			onUpdate: async (_ctx, _oldUser, _newUser) => {},
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
