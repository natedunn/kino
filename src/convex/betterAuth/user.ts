import { doc } from 'convex-helpers/validators';
import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import schema, { tables } from './generatedSchema';

export const updateUser = mutation({
	args: {
		_id: v.string(),
		username: tables.user.validator.fields.username,
		profileId: tables.user.validator.fields.profileId,
	},
	handler: async (ctx, args) => {
		return await ctx.db.patch(args._id as Id<'user'>, {
			username: args.username,
			profileId: args.profileId,
		});
	},
});

const user = doc(schema, 'user');

export const get = query({
	args: {
		profileId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query('user')
			.withIndex('profileId', (q) => q.eq('profileId', args.profileId))
			.unique();
	},
	returns: v.union(user, v.null()),
});
