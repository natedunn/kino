import { doc } from 'convex-helpers/validators';
import { ConvexError, v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { query } from './_generated/server';
import schema from './generatedSchema';
import { getOrgBySlug } from './utils';

const user = doc(schema, 'user');

export const getList = query({
	args: {
		slug: v.string(),
	},
	handler: async (ctx, args) => {
		const org = await getOrgBySlug(ctx, args.slug);

		if (!org) {
			throw new ConvexError({
				message: 'Organization not found',
				code: '404',
			});
		}

		const members = await ctx.db
			.query('member')
			.withIndex('organizationId', (q) => q.eq('organizationId', org._id))
			.collect();

		if (!members) {
			return null;
		}

		const users = await Promise.all(
			members.map(async (member) => await ctx.db.get(member.userId as Id<'user'>))
		);

		return !users ? null : users.filter((user) => user !== undefined && user !== null);
	},
	returns: v.union(v.array(user), v.null()),
});
