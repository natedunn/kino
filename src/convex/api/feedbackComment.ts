import { createAuth } from '@/lib/auth';

import { feedbackCommentCreateSchema } from '../schema/feedbackComment.schema';
import { procedure } from './procedure';
import { triggers } from './utils/trigger';

export const create = procedure.authed.external.mutation({
	args: feedbackCommentCreateSchema,
	handler: async (ctx, args) => {
		const auth = createAuth(ctx);
	},
});

triggers.register('feedbackComment', async (ctx, change) => {
	if (change.operation === 'delete') {
		const emotes = await ctx.db
			.query('feedbackCommentEmote')
			.withIndex('by_feedbackCommentId', (q) => q.eq('feedbackCommentId', change.oldDoc._id))
			.collect();

		emotes.forEach(async (emote) => {
			await ctx.db.delete(emote._id);
		});
	}
});
