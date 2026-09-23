import { ConvexError, v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { activeBoard, activeComment, activeFeedback, owner } from './lifecycle';

export const createProject = mutation({
	args: { organizationId: v.id('organizations') },
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		const userId = identity && ctx.db.normalizeId('users', identity.subject);
		const user = userId && (await ctx.db.get(userId));
		const organization = await ctx.db.get(args.organizationId);
		if (!user?.verified || organization?.ownerId !== user._id) throw new ConvexError('FORBIDDEN');
		const projectId = await ctx.db.insert('projects', {
			organizationId: args.organizationId,
			ownerId: user._id,
			deleting: false,
		});
		for (const name of ['Bugs', 'Feature Requests', 'Improvements'])
			await ctx.db.insert('boards', { projectId, name });
		return projectId;
	},
});
export const create = mutation({
	args: { boardId: v.id('boards'), title: v.string(), content: v.string() },
	handler: async (ctx, args) => {
		const board = await activeBoard(ctx, args.boardId);
		if (!args.title.trim() || args.title.length > 200 || args.content.length > 10000)
			throw new ConvexError('INVALID_CONTENT');
		const feedbackId = await ctx.db.insert('feedback', {
			projectId: board.projectId,
			boardId: board._id,
			title: args.title,
			upvotes: 0,
			searchContent: args.title + ' ' + args.content,
		});
		const commentId = await ctx.db.insert('comments', {
			projectId: board.projectId,
			boardId: board._id,
			feedbackId,
			initial: true,
			content: args.content,
		});
		await ctx.db.patch(feedbackId, { firstCommentId: commentId });
		return { feedbackId, commentId };
	},
});
export const editComment = mutation({
	args: { commentId: v.id('comments'), content: v.string() },
	handler: async (ctx, args) => {
		const comment = await activeComment(ctx, args.commentId);
		if (args.content.length > 10000) throw new ConvexError('INVALID_CONTENT');
		await ctx.db.patch(comment._id, { content: args.content });
		if (comment.initial) {
			const feedback = await activeFeedback(ctx, comment.feedbackId);
			await ctx.db.patch(feedback._id, {
				searchContent: (feedback.title ?? '') + ' ' + args.content,
			});
		}
		return null;
	},
});
export const setVote = mutation({
	args: { feedbackId: v.id('feedback'), enabled: v.boolean() },
	handler: async (ctx, args) => {
		const feedback = await activeFeedback(ctx, args.feedbackId);
		const project = await owner(ctx, feedback.projectId);
		const userId = project.ownerId;
		const existing = await ctx.db
			.query('votes')
			.withIndex('by_feedbackId_userId', (q) =>
				q.eq('feedbackId', feedback._id).eq('userId', userId)
			)
			.unique();
		if (args.enabled === !!existing) return null;
		if (args.enabled)
			await ctx.db.insert('votes', {
				projectId: feedback.projectId,
				boardId: feedback.boardId,
				feedbackId: feedback._id,
				userId,
			});
		else await ctx.db.delete(existing!._id);
		await ctx.db.patch(feedback._id, {
			upvotes: (feedback.upvotes ?? 0) + (args.enabled ? 1 : -1),
		});
		return null;
	},
});
export const event = mutation({
	args: {
		feedbackId: v.id('feedback'),
		kind: v.union(v.literal('status'), v.literal('assignment')),
	},
	handler: async (ctx, args) => {
		const feedback = await activeFeedback(ctx, args.feedbackId);
		return ctx.db.insert('events', {
			projectId: feedback.projectId,
			boardId: feedback.boardId,
			feedbackId: feedback._id,
			kind: args.kind,
		});
	},
});
export const connectRepository = mutation({
	args: { projectId: v.id('projects'), remoteId: v.string() },
	handler: async (ctx, args) => {
		await owner(ctx, args.projectId);
		if (!args.remoteId || args.remoteId.length > 100) throw new ConvexError('INVALID_REMOTE');
		return ctx.db.insert('repositories', args);
	},
});
export const link = mutation({
	args: { feedbackId: v.id('feedback'), repositoryId: v.id('repositories'), remoteId: v.string() },
	handler: async (ctx, args) => {
		const feedback = await activeFeedback(ctx, args.feedbackId);
		const repository = await ctx.db.get(args.repositoryId);
		if (repository?.projectId !== feedback.projectId) throw new ConvexError('INVALID_PARENT');
		if (!args.remoteId || args.remoteId.length > 100) throw new ConvexError('INVALID_REMOTE');
		return ctx.db.insert('links', {
			projectId: feedback.projectId,
			boardId: feedback.boardId,
			...args,
		});
	},
});
export const read = query({
	args: { feedbackId: v.id('feedback') },
	handler: async (ctx, args) => {
		const feedback = await activeFeedback(ctx, args.feedbackId);
		const comments = await ctx.db
			.query('comments')
			.withIndex('by_feedbackId', (q) => q.eq('feedbackId', feedback._id))
			.take(25);
		// A deleting comment is unavailable immediately, even before pointer cleanup finishes.
		const answer = feedback.answerId && (await ctx.db.get(feedback.answerId));
		return {
			...feedback,
			answerId: answer && !answer.deleting ? answer._id : null,
			comments: await Promise.all(
				comments
					.filter((comment) => !comment.deleting)
					.map(async (comment) => {
						const reply = comment.replyId && (await ctx.db.get(comment.replyId));
						return { ...comment, replyId: reply && !reply.deleting ? reply._id : undefined };
					})
			),
		};
	},
});
