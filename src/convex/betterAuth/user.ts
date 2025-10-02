import { doc } from 'convex-helpers/validators';
import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import schema, { tables } from './generatedSchema';

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

const user = doc(schema, 'user');

export const get = query({
	args: {
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query('user')
			.withIndex('userId', (q) => q.eq('userId', args.userId))
			.unique();
	},
	returns: v.union(user, v.null()),
});
