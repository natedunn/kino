import type { AuthFunctions, GenericCtx } from '@convex-dev/better-auth';

import { createClient } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { betterAuth } from 'better-auth';
import { admin, organization, username } from 'better-auth/plugins';
import { adjectives, nouns, uniqueUsernameGenerator } from 'unique-username-generator';

import { components, internal } from './_generated/api';
import { DataModel, Id } from './_generated/dataModel';
import { query } from './_generated/server';
import authSchema from './betterAuth/schema';
import { userSelectSchema } from './schema/user.schema';

const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel, typeof authSchema>(components.betterAuth, {
	authFunctions,
	local: {
		schema: authSchema,
	},
	verbose: false,
	triggers: {
		user: {
			onCreate: async (ctx, authUser) => {
				const generatedUsername = uniqueUsernameGenerator({
					length: 39,
					separator: '',
					style: 'pascalCase',
					dictionaries: [adjectives, nouns],
					randomDigits: 3,
				});

				const userId = await ctx.db.insert('user', {
					email: authUser.email,
					name: authUser.name,
					username: authUser.username ?? generatedUsername,
					imageUrl: typeof authUser.image === 'string' ? authUser.image : undefined,
					banned: false,
					private: false,
				});

				await authComponent.setUserId(ctx, authUser._id, userId);
			},
			onDelete: async (ctx, user) => {
				await ctx.db.delete(user.userId as Id<'user'>);
			},
			onUpdate: async (ctx, _oldUser, newUser) => {
				if (!newUser.username) {
					console.error('No username provided in onUpdateUser.');
				}

				// Keep the user's email synced
				const userId = newUser.userId as Id<'user'>;
				await ctx.db.patch(userId, {
					email: newUser.email,
					name: newUser.name,
					imageUrl: typeof newUser.image === 'string' ? newUser.image : undefined,
					username: typeof newUser.username === 'string' ? newUser.username : undefined,
				});
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
				// NOTE: make sure this matches zod schema for now
				minUsernameLength: 3,
				maxUsernameLength: 39,
			}),
			admin(),
			organization(),
			convex(),
		],
	});
};

// Example function for getting the current user
// Feel free to edit, omit, etc.
export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		const userMetadata = await authComponent.safeGetAuthUser(ctx);

		if (!userMetadata) {
			return null;
		}

		const userData = await ctx.db.get(userMetadata.userId as Id<'user'>);

		const user = userSelectSchema.parse(userData);

		return {
			...user,
			...userMetadata,
		};
	},
});
