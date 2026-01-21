import { zodToConvex } from 'convex-helpers/server/zod4';
import { ConvexError } from 'convex/values';

import { query } from './_generated/server';
import { getMyProfile } from './profile.lib';
import { feedbackCommentCreateSchema, feedbackCommentSchema } from './schema/feedbackComment.schema';
import { mutation } from './utils/functions';
import { triggers } from './utils/trigger';
import { insert } from './utils/verify';

export const create = mutation({
	args: zodToConvex(feedbackCommentCreateSchema),
	handler: async (ctx, args) => {
		const profile = await getMyProfile(ctx);

		const commentId = await insert(ctx, 'feedbackComment', {
			feedbackId: args.feedbackId,
			authorProfileId: profile._id,
			content: args.content,
			initial: false,
		});

		return { commentId };
	},
});

export const update = mutation({
	args: zodToConvex(feedbackCommentSchema.pick({ _id: true, content: true })),
	handler: async (ctx, args) => {
		const profile = await getMyProfile(ctx);

		const comment = await ctx.db.get(args._id);

		if (!comment) {
			throw new ConvexError({
				message: 'Comment not found',
				code: '404',
			});
		}

		// Only the author can edit their own comments - NOT admins
		if (comment.authorProfileId !== profile._id) {
			throw new ConvexError({
				message: 'You can only edit your own comments',
				code: '403',
			});
		}

		await ctx.db.patch(args._id, {
			content: args.content,
		});

		return { updated: true };
	},
});

export const remove = mutation({
	args: zodToConvex(feedbackCommentSchema.pick({ _id: true })),
	handler: async (ctx, args) => {
		const profile = await getMyProfile(ctx);

		const comment = await ctx.db.get(args._id);

		if (!comment) {
			throw new ConvexError({
				message: 'Comment not found',
				code: '404',
			});
		}

		// Server-side ownership check
		if (comment.authorProfileId !== profile._id) {
			throw new ConvexError({
				message: 'You can only delete your own comments',
				code: '403',
			});
		}

		// Don't allow deleting initial comments
		if (comment.initial) {
			throw new ConvexError({
				message: 'Cannot delete the initial feedback comment',
				code: '400',
			});
		}

		await ctx.db.delete(args._id);

		return { deleted: true };
	},
});

export const listByFeedback = query({
	args: zodToConvex(feedbackCommentSchema.pick({ feedbackId: true })),
	handler: async (ctx, { feedbackId }) => {
		const comments = await ctx.db
			.query('feedbackComment')
			.withIndex('by_feedbackId', (q) => q.eq('feedbackId', feedbackId))
			.order('asc')
			.collect();

		// Get author profiles and emotes for each comment
		const commentsWithDetails = await Promise.all(
			comments.map(async (comment) => {
				const author = await ctx.db.get(comment.authorProfileId);

				// Get emotes for this comment
				const emotes = await ctx.db
					.query('feedbackCommentEmote')
					.withIndex('by_feedbackCommentId', (q) => q.eq('feedbackCommentId', comment._id))
					.collect();

				// Group emotes by content type and count them
				const emoteCounts: Record<string, { count: number; authorProfileIds: string[] }> = {};
				for (const emote of emotes) {
					if (!emoteCounts[emote.content]) {
						emoteCounts[emote.content] = { count: 0, authorProfileIds: [] };
					}
					emoteCounts[emote.content].count++;
					emoteCounts[emote.content].authorProfileIds.push(emote.authorProfileId);
				}

				return {
					...comment,
					author: author
						? {
								_id: author._id,
								username: author.username,
								name: author.name,
								imageUrl: author.imageUrl,
							}
						: null,
					emoteCounts,
				};
			})
		);

		return commentsWithDetails;
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

	// Update feedback searchContent when initial comment is edited
	if (change.operation === 'update' && change.newDoc.initial) {
		const feedback = await ctx.db.get(change.newDoc.feedbackId);
		if (feedback) {
			await ctx.db.patch(feedback._id, {
				searchContent: feedback.title + ' ' + change.newDoc.content,
			});
		}
	}
});
