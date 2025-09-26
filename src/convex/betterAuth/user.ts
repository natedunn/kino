import { authComponent, createAuth } from '@convex/auth';
import { v } from 'convex/values';
import { uniqueUsernameGenerator } from 'unique-username-generator';

import { Id } from './_generated/dataModel';
import { mutation } from './_generated/server';
import { tables } from './generatedSchema';

export const updateUsername = mutation({
	args: {
		authId: v.string(),
		username: tables.user.validator.fields.username,
	},
	handler: async (ctx, args) => {
		console.log('Updating username.');

		return await ctx.db.patch(args.authId as Id<'user'>, {
			username: args.username,
		});
	},
});
