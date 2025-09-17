import { feedbackCommentCreateSchema } from './schema/feedbackComment.schema';
import { zAuthedMutation } from './utils/functions';
import { triggers } from './utils/trigger';

export const create = zAuthedMutation({
	args: feedbackCommentCreateSchema,
	handler: async () => {},
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
