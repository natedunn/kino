import { mutationGeneric, queryGeneric } from 'convex/server';
import { v } from 'convex/values';

// Test-only inspection registered INSIDE the core's convex-test component.
// No production extension writes or reads private core storage.
export const counts = queryGeneric({
	args: {},
	returns: v.object({ accounts: v.number(), sessions: v.number() }),
	handler: async (ctx) => ({
		accounts: (await ctx.db.query('accounts').take(10)).length,
		sessions: (await ctx.db.query('sessions').take(10)).length,
	}),
});

// Simulate a session persisted before the optional generation field existed.
export const makeLegacy = mutationGeneric({
	args: { userId: v.string() },
	returns: v.null(),
	handler: async (ctx, { userId }) => {
		const session = await ctx.db
			.query('sessions')
			.withIndex('by_user', (q) => q.eq('userId', userId))
			.first();
		if (!session) throw new Error('Missing fixture session');
		await ctx.db.patch(session._id, { generation: undefined });
		return null;
	},
});
