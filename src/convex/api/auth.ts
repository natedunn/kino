import { AuthFunctions, BetterAuth, PublicAuthFunctions } from '@convex-dev/better-auth';
import { User } from 'better-auth';
import generateRandomUsername from 'generate-random-username';

import { api, components, internal } from '../_generated/api';
import { DataModel, Id } from '../_generated/dataModel';
import { procedure } from './procedure';

const authFunctions: AuthFunctions = internal.api.auth;
const publicAuthFunctions: PublicAuthFunctions = api.api.auth;

export const betterAuthComponent = new BetterAuth(components.betterAuth, {
	authFunctions,
	publicAuthFunctions,
	// verbose: true,
});

export const { createUser, deleteUser, updateUser, createSession, isAuthenticated } =
	betterAuthComponent.createAuthFunctions<DataModel>({
		onCreateUser: async (ctx, user) => {
			const generatedUsername = generateRandomUsername({ separator: '_' });

			const userId = await ctx.db.insert('user', {
				email: user.email,
				name: user.name,
				username: user?.username ?? generatedUsername,
				imageUrl: typeof user.image === 'string' ? user.image : undefined,
				banned: false,
				globalRole: 'user',
				private: false,
			});

			// This function must return the user id.
			return userId;
		},
		onDeleteUser: async (ctx, userId) => {
			await ctx.db.delete(userId as Id<'user'>);
		},
		onUpdateUser: async (ctx, user) => {
			if (!user.username) {
				console.error('No username provided in onUpdateUser.');
			}

			// Keep the user's email synced
			const userId = user.userId as Id<'user'>;
			await ctx.db.patch(userId, {
				email: user.email,
				name: user.name,
				imageUrl: typeof user.image === 'string' ? user.image : undefined,
				username: typeof user.username === 'string' ? user.username : undefined,
			});
		},
	});

// Example function for getting the current user
// Feel free to edit, omit, etc.
export const getCurrentUser = procedure.base.external.query({
	args: {},
	handler: async (ctx) => {
		const userMetadata = (await betterAuthComponent.getAuthUser(ctx)) as
			| (Omit<User, 'id'> & {
					_id: string;
					_creationTime: number;
					userId: string;
			  })
			| null;

		if (!userMetadata) {
			return null;
		}

		const user = await ctx.db.get(userMetadata.userId as Id<'user'>);
		return {
			...user,
			...userMetadata,
		};
	},
});
