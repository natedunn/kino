import { procedure } from './procedure';
import { triggers } from './utils/trigger';

export const create = procedure.authed.external.mutation({
	args: {},
	handler: async (ctx) => {},
});

triggers.register('feedback', async (ctx, change) => {
	if (change.operation === 'delete') {
		const comments = await ctx.db
			.query('feedbackComment')
			.withIndex('by_feedbackId', (q) => q.eq('feedbackId', change.oldDoc._id))
			.collect();

		comments.forEach(async (comment) => {
			await ctx.db.delete(comment._id);
		});
	}
});
