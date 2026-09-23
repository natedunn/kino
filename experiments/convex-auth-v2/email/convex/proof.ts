import type { QueryCtx } from './_generated/server';

import { ConvexError, v } from 'convex/values';

import { mutation, query } from './_generated/server';

async function owner(ctx: QueryCtx) {
	const identity = await ctx.auth.getUserIdentity();
	const id = identity && ctx.db.normalizeId('users', identity.subject);
	const user = id && (await ctx.db.get(id));
	if (!user || !user.verified) throw new ConvexError('UNAUTHORIZED');
	return user._id;
}
const slug = v.union(v.literal('alpha'), v.literal('beta'));
export const read = query({
	args: { slug },
	handler: async (ctx, { slug }) => {
		const userId = await owner(ctx);
		const row = await ctx.db
			.query('counters')
			.withIndex('by_userId_and_slug', (q) => q.eq('userId', userId).eq('slug', slug))
			.unique();
		return { userId, slug, value: row?.value ?? 0 };
	},
});
export const increment = mutation({
	args: { slug },
	handler: async (ctx, { slug }) => {
		const userId = await owner(ctx);
		const row = await ctx.db
			.query('counters')
			.withIndex('by_userId_and_slug', (q) => q.eq('userId', userId).eq('slug', slug))
			.unique();
		if (row) await ctx.db.patch(row._id, { value: row.value + 1 });
		else await ctx.db.insert('counters', { userId, slug, value: 1 });
		return null;
	},
});
