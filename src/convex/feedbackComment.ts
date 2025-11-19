import { ConvexError } from 'convex/values';

import { triggers } from './utils/trigger';
import { verify } from './utils/verify';

triggers.register('feedbackComment', async (ctx, change) => {
	// if (change.operation === 'insert') {
	// 	const feedback = await ctx.db.get(change.newDoc.feedbackId);

	// 	if (!feedback) {
	// 		throw new ConvexError({
	// 			message: 'Feedback not found',
	// 			code: '404',
	// 		});
	// 	}

	// 	await verify.patch({
	// 		ctx,
	// 		tableName: 'feedback',
	// 		data: {
	// 			_id: feedback._id,
	// 			firstCommentId: change.newDoc._id,
	// 		},
	// 	});
	// }

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
