import { zodToConvex } from 'convex-helpers/server/zod4';
import { ConvexError } from 'convex/values';

import { feedbackCreateSchema } from './schema/feedback.schema';
import { mutation } from './utils/functions';
import { getCurrentProfile } from './utils/queries/getCurrentProfile';
import { triggers } from './utils/trigger';
import { verify } from './utils/verify';

export const create = mutation({
	args: zodToConvex(feedbackCreateSchema),
	handler: async (ctx, args) => {
		const profile = await getCurrentProfile(ctx);

		if (!profile) {
			throw new ConvexError({
				message: 'Profile not found',
				code: '404',
			});
		}

		const feedbackId = await verify.insert({
			ctx,
			tableName: 'feedback',
			data: {
				projectId: args.projectId,
				boardId: args.boardId,
				title: args.title,
				authorProfileId: profile._id,
				upvotes: 0,
			},
		});

		const feedbackCommentId = await verify.insert({
			ctx,
			tableName: 'feedbackComment',
			data: {
				feedbackId: feedbackId,
				authorProfileId: profile._id,
				content: args.firstComment,
				initial: true,
			},
		});

		await verify.patch({
			ctx,
			tableName: 'feedback',
			data: {
				_id: feedbackId,
				firstCommentId: feedbackCommentId,
			},
		});

		return {
			feedbackId,
			feedbackCommentId,
		};
	},
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
