import { query } from './_generated/server';

export const current = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;
		const id = ctx.db.normalizeId('users', identity.subject);
		if (!id) return null;
		const user = await ctx.db.get(id);
		return user ? { userId: user._id, verified: user.verified } : null;
	},
});
