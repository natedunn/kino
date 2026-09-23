import type { Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

import { ConvexError, v } from 'convex/values';

import { mutation } from './_generated/server';
import { assertProjectWritable, requireProjectAccess } from './access';
import { isFeedbackLive } from './feedbackLifecycle';
import { requireCurrentUser } from './identity';

async function profileForWrite(ctx: QueryCtx) {
	const user = await requireCurrentUser(ctx);
	if (!user.profileId) throw new ConvexError('PROFILE_NOT_FOUND');
	const profile = await ctx.db.get('profiles', user.profileId);
	if (!profile) throw new ConvexError('PROFILE_NOT_FOUND');
	return profile;
}

async function writableFeedback(ctx: QueryCtx, feedbackId: Id<'feedback'>) {
	const feedback = await ctx.db.get('feedback', feedbackId);
	if (!feedback || !(await isFeedbackLive(ctx, feedback)))
		throw new ConvexError('FEEDBACK_NOT_FOUND');
	const access = await requireProjectAccess(ctx, feedback.projectId);
	assertProjectWritable(access);
	return { access, feedback };
}

export const create = mutation({
	args: {
		feedbackId: v.id('feedback'),
		content: v.string(),
		replyFeedbackCommentId: v.optional(v.id('feedbackComments')),
	},
	handler: async (ctx, args) => {
		const [profile, { feedback }] = await Promise.all([
			profileForWrite(ctx),
			writableFeedback(ctx, args.feedbackId),
		]);
		const content = args.content.trim();
		if (!content || content.length > 50_000) throw new ConvexError('INVALID_COMMENT');
		if (args.replyFeedbackCommentId) {
			const parent = await ctx.db.get('feedbackComments', args.replyFeedbackCommentId);
			if (!parent || parent.feedbackId !== feedback._id) throw new ConvexError('INVALID_REPLY');
		}
		const id = await ctx.db.insert('feedbackComments', {
			feedbackId: feedback._id,
			authorProfileId: profile._id,
			content,
			initial: false,
			...(args.replyFeedbackCommentId
				? { replyFeedbackCommentId: args.replyFeedbackCommentId }
				: {}),
		});
		await ctx.db.insert('feedbackTimelineEntries', {
			feedbackId: feedback._id,
			kind: 'comment',
			commentId: id,
		});
		await ctx.db.patch('feedback', feedback._id, { updatedAt: Date.now() });
		return { id };
	},
});

export const update = mutation({
	args: { commentId: v.id('feedbackComments'), content: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const profile = await profileForWrite(ctx);
		const comment = await ctx.db.get('feedbackComments', args.commentId);
		if (!comment) throw new ConvexError('COMMENT_NOT_FOUND');
		await writableFeedback(ctx, comment.feedbackId);
		if (comment.authorProfileId !== profile._id) throw new ConvexError('FORBIDDEN');
		const content = args.content.trim();
		if (!content || content.length > 50_000) throw new ConvexError('INVALID_COMMENT');
		await ctx.db.patch('feedbackComments', comment._id, { content, updatedAt: Date.now() });
		if (comment.initial) {
			const feedback = await ctx.db.get('feedback', comment.feedbackId);
			if (feedback)
				await ctx.db.patch('feedback', feedback._id, {
					searchContent: `${feedback.title} ${content}`,
					updatedAt: Date.now(),
				});
		}
		return null;
	},
});

export const remove = mutation({
	args: { commentId: v.id('feedbackComments') },
	returns: v.null(),
	handler: async (ctx, { commentId }) => {
		const profile = await profileForWrite(ctx);
		const comment = await ctx.db.get('feedbackComments', commentId);
		if (!comment) throw new ConvexError('COMMENT_NOT_FOUND');
		const { access, feedback } = await writableFeedback(ctx, comment.feedbackId);
		if (comment.initial) throw new ConvexError('INITIAL_COMMENT_REQUIRED');
		if (comment.authorProfileId !== profile._id && !access.permissions.canManageContent)
			throw new ConvexError('FORBIDDEN');

		const [emotes, replies, timelineEntries] = await Promise.all([
			ctx.db
				.query('feedbackCommentEmotes')
				.withIndex('by_feedbackCommentId', (q) => q.eq('feedbackCommentId', commentId))
				.take(101),
			ctx.db
				.query('feedbackComments')
				.withIndex('by_replyFeedbackCommentId', (q) => q.eq('replyFeedbackCommentId', commentId))
				.take(101),
			ctx.db
				.query('feedbackTimelineEntries')
				.withIndex('by_commentId', (q) => q.eq('commentId', commentId))
				.take(101),
		]);
		if (emotes.length > 100 || replies.length > 100 || timelineEntries.length > 100)
			throw new ConvexError('CASCADE_TOO_LARGE');
		for (const emote of emotes) await ctx.db.delete('feedbackCommentEmotes', emote._id);
		for (const entry of timelineEntries) await ctx.db.delete('feedbackTimelineEntries', entry._id);
		for (const reply of replies)
			await ctx.db.patch('feedbackComments', reply._id, { replyFeedbackCommentId: undefined });
		if (feedback.answerCommentId === commentId)
			await ctx.db.patch('feedback', feedback._id, {
				answerCommentId: undefined,
				updatedAt: Date.now(),
			});
		await ctx.db.delete('feedbackComments', commentId);
		return null;
	},
});

export const toggleEmote = mutation({
	args: {
		feedbackId: v.id('feedback'),
		feedbackCommentId: v.id('feedbackComments'),
		content: v.string(),
	},
	handler: async (ctx, args) => {
		const [profile, { feedback }] = await Promise.all([
			profileForWrite(ctx),
			writableFeedback(ctx, args.feedbackId),
		]);
		const content = args.content.trim();
		if (!content || content.length > 32) throw new ConvexError('INVALID_EMOTE');
		const comment = await ctx.db.get('feedbackComments', args.feedbackCommentId);
		if (!comment || comment.feedbackId !== feedback._id) throw new ConvexError('INVALID_COMMENT');
		const existing = await ctx.db
			.query('feedbackCommentEmotes')
			.withIndex('by_feedbackCommentId_and_authorProfileId_and_content', (q) =>
				q
					.eq('feedbackCommentId', comment._id)
					.eq('authorProfileId', profile._id)
					.eq('content', content)
			)
			.unique();
		if (existing) {
			await ctx.db.delete('feedbackCommentEmotes', existing._id);
			return { action: 'removed' as const };
		}
		await ctx.db.insert('feedbackCommentEmotes', {
			feedbackId: feedback._id,
			feedbackCommentId: comment._id,
			authorProfileId: profile._id,
			content,
			updatedAt: Date.now(),
		});
		return { action: 'added' as const };
	},
});
