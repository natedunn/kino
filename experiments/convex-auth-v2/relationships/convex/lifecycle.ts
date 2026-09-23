import type { Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

import { makeFunctionReference } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { internalMutation, mutation, query } from './_generated/server';
import { resumeProjectStorage, scheduleAssetCleanup } from './projectStorage';

export const BATCH_SIZE = 25;
const stages = [
	'reactions',
	'votes',
	'events',
	'links',
	'comments',
	'feedback',
	'boards',
	'folders',
	'repositories',
] as const;
const stepRef = makeFunctionReference<'mutation'>('lifecycle:step');
export async function owner(ctx: QueryCtx, projectId: Id<'projects'>, allowDeleting = false) {
	const identity = await ctx.auth.getUserIdentity();
	const userId = identity && ctx.db.normalizeId('users', identity.subject);
	const user = userId && (await ctx.db.get(userId));
	const project = await ctx.db.get(projectId);
	if (!user?.verified || !project || project.ownerId !== user._id)
		throw new ConvexError('FORBIDDEN');
	if (project.organizationId && (await ctx.db.get(project.organizationId))?.ownerId !== user._id)
		throw new ConvexError('FORBIDDEN');
	if (project.deleting && !allowDeleting) throw new ConvexError('DELETING');
	return project;
}
export const read = query({
	args: { projectId: v.id('projects') },
	handler: async (ctx, args) => {
		await owner(ctx, args.projectId);
		const boards = await ctx.db
			.query('boards')
			.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
			.take(25);
		return boards.filter((board) => !board.deleting);
	},
});
export const createBoard = mutation({
	args: { projectId: v.id('projects'), name: v.string() },
	handler: async (ctx, args) => {
		await owner(ctx, args.projectId);
		if (!args.name || args.name.length > 100) throw new ConvexError('INVALID_NAME');
		return ctx.db.insert('boards', args);
	},
});
export const createFeedback = mutation({
	args: { projectId: v.id('projects'), boardId: v.id('boards') },
	handler: async (ctx, args) => {
		await owner(ctx, args.projectId);
		const board = await activeBoard(ctx, args.boardId, args.projectId);
		if (board.projectId !== args.projectId) throw new ConvexError('INVALID_PARENT');
		return ctx.db.insert('feedback', args);
	},
});
export const createComment = mutation({
	args: {
		projectId: v.id('projects'),
		feedbackId: v.id('feedback'),
		replyId: v.optional(v.id('comments')),
	},
	handler: async (ctx, args) => {
		await owner(ctx, args.projectId);
		const feedback = await activeFeedback(ctx, args.feedbackId, args.projectId);
		if (feedback.projectId !== args.projectId) throw new ConvexError('INVALID_PARENT');
		if (
			args.replyId &&
			(await activeComment(ctx, args.replyId, args.feedbackId)).feedbackId !== args.feedbackId
		)
			throw new ConvexError('INVALID_PARENT');
		return ctx.db.insert('comments', { ...args, boardId: feedback.boardId });
	},
});
export const answer = mutation({
	args: { feedbackId: v.id('feedback'), commentId: v.id('comments') },
	handler: async (ctx, args) => {
		const feedback = await activeFeedback(ctx, args.feedbackId);
		if (!feedback) throw new ConvexError('INVALID_PARENT');
		await owner(ctx, feedback.projectId);
		if ((await activeComment(ctx, args.commentId, feedback._id)).feedbackId !== feedback._id)
			throw new ConvexError('INVALID_PARENT');
		await ctx.db.patch(feedback._id, { answerId: args.commentId });
		return null;
	},
});
export const react = mutation({
	args: { commentId: v.id('comments') },
	handler: async (ctx, args) => {
		const comment = await activeComment(ctx, args.commentId);
		if (!comment) throw new ConvexError('INVALID_PARENT');
		await owner(ctx, comment.projectId);
		return ctx.db.insert('reactions', {
			projectId: comment.projectId,
			boardId: comment.boardId,
			feedbackId: comment.feedbackId,
			commentId: comment._id,
		});
	},
});
export const removeComment = mutation({
	args: { commentId: v.id('comments') },
	handler: async (ctx, args) => {
		const comment = await activeComment(ctx, args.commentId);
		if (!comment) throw new ConvexError('INVALID_PARENT');
		await owner(ctx, comment.projectId);
		if (comment.initial) throw new ConvexError('INITIAL_COMMENT');
		const replies = await ctx.db
			.query('comments')
			.withIndex('by_replyId', (q) => q.eq('replyId', comment._id))
			.take(26);
		const answers = await ctx.db
			.query('feedback')
			.withIndex('by_answerId', (q) => q.eq('answerId', comment._id))
			.take(26);
		const reactions = await ctx.db
			.query('reactions')
			.withIndex('by_commentId', (q) => q.eq('commentId', comment._id))
			.take(26);
		if ([replies, answers, reactions].some((rows) => rows.length > BATCH_SIZE))
			throw new ConvexError('REQUIRES_BATCH_JOB');
		for (const row of replies) await ctx.db.patch(row._id, { replyId: undefined });
		for (const row of answers) await ctx.db.patch(row._id, { answerId: undefined });
		for (const row of reactions) await ctx.db.delete(row._id);
		await ctx.db.delete(comment._id);
		return null;
	},
});
export const createFolder = mutation({
	args: { projectId: v.id('projects'), parentId: v.optional(v.id('folders')) },
	handler: async (ctx, args) => {
		await owner(ctx, args.projectId);
		if (args.parentId && (await ctx.db.get(args.parentId))?.projectId !== args.projectId)
			throw new ConvexError('INVALID_PARENT');
		return ctx.db.insert('folders', args);
	},
});
export const removeFolder = mutation({
	args: { folderId: v.id('folders') },
	handler: async (ctx, args) => {
		const folder = await ctx.db.get(args.folderId);
		if (!folder) throw new ConvexError('INVALID_PARENT');
		await owner(ctx, folder.projectId);
		if (
			await ctx.db
				.query('folders')
				.withIndex('by_parentId', (q) => q.eq('parentId', folder._id))
				.first()
		)
			throw new ConvexError('FOLDER_NOT_EMPTY');
		await ctx.db.delete(folder._id);
		return null;
	},
});
export const beginDelete = mutation({
	args: { projectId: v.id('projects') },
	handler: async (ctx, args) => {
		const project = await owner(ctx, args.projectId, true);
		const existing = await ctx.db
			.query('jobs')
			.withIndex('by_projectId', (q) => q.eq('projectId', project._id))
			.unique();
		if (existing) return existing._id;
		await ctx.db.patch(project._id, { deleting: true });
		const jobId = await ctx.db.insert('jobs', {
			projectId: project._id,
			ownerId: project.ownerId,
			phase: 0,
			version: 0,
			processed: 0,
			done: false,
		});
		await ctx.scheduler.runAfter(0, stepRef, { jobId, version: 0 });
		return jobId;
	},
});
export const step = internalMutation({
	args: { jobId: v.id('jobs'), version: v.number() },
	handler: async (ctx, args) => {
		const job = await ctx.db.get(args.jobId);
		if (!job || job.done || job.version !== args.version) return null;
		const project = await ctx.db.get(job.projectId);
		if (!project?.deleting) throw new ConvexError('INVALID_DELETION_FENCE');
		const activeStorageJob = await ctx.db
			.query('storageCleanupJobs')
			.withIndex('by_projectId', (q) => q.eq('projectId', project._id))
			.filter((q) => q.neq(q.field('state'), 'done'))
			.first();
		if (activeStorageJob) return null;
		const assets = await ctx.db
			.query('fileAssets')
			.withIndex('by_projectId_cleanupJobId', (q) =>
				q.eq('projectId', project._id).eq('cleanupJobId', undefined)
			)
			.take(BATCH_SIZE);
		if (assets.length) {
			for (const asset of assets) await scheduleAssetCleanup(ctx, job._id, asset._id);
			const version = job.version + 1;
			await ctx.db.patch(job._id, { version });
			return null;
		}
		if (job.phase === 0) {
			const usage = await ctx.db
				.query('projectStorageUsage')
				.withIndex('by_projectId', (q) => q.eq('projectId', project._id))
				.unique();
			if (usage && (usage.usedBytes !== 0 || usage.reservedBytes !== 0 || usage.fileCount !== 0))
				throw new ConvexError('STORAGE_ACCOUNTING_NOT_ZERO');
			for (const storageTable of [
				'fileObjects',
				'fileAssets',
				'projectStorageUsage',
				'storageCleanupJobs',
			] as const) {
				const storageBatch = await ctx.db
					.query(storageTable)
					.withIndex('by_projectId', (q) => q.eq('projectId', project._id))
					.take(BATCH_SIZE);
				if (!storageBatch.length) continue;
				for (const row of storageBatch) await ctx.db.delete(row._id);
				const version = job.version + 1;
				await ctx.db.patch(job._id, {
					version,
					processed: job.processed + storageBatch.length,
				});
				await ctx.scheduler.runAfter(0, stepRef, { jobId: job._id, version });
				return null;
			}
		}
		const table = stages[job.phase];
		if (!table) {
			await ctx.db.delete(project._id);
			await ctx.db.patch(job._id, { done: true, version: job.version + 1 });
			return null;
		}
		const batch = await ctx.db
			.query(table)
			.withIndex('by_projectId', (q) => q.eq('projectId', project._id))
			.take(BATCH_SIZE);
		for (const row of batch) await ctx.db.delete(row._id);
		const version = job.version + 1;
		await ctx.db.patch(job._id, {
			version,
			processed: job.processed + batch.length,
			phase: job.phase + (batch.length < BATCH_SIZE ? 1 : 0),
		});
		await ctx.scheduler.runAfter(0, stepRef, { jobId: job._id, version });
		return null;
	},
});
export const resume = mutation({
	args: { jobId: v.id('jobs') },
	handler: async (ctx, args) => {
		const job = await ctx.db.get(args.jobId);
		if (!job) throw new ConvexError('FORBIDDEN');
		const identity = await ctx.auth.getUserIdentity();
		const userId = identity && ctx.db.normalizeId('users', identity.subject);
		const user = userId && (await ctx.db.get(userId));
		if (!user?.verified || user._id !== job.ownerId) throw new ConvexError('FORBIDDEN');
		if (!job.done) {
			await owner(ctx, job.projectId, true);
			await resumeProjectStorage(ctx, job.projectId);
			await ctx.scheduler.runAfter(0, stepRef, { jobId: job._id, version: job.version });
		}
		return null;
	},
});

export async function activeBoard(
	ctx: QueryCtx,
	id: Id<'boards'>,
	expectedProjectId?: Id<'projects'>
) {
	const row = await ctx.db.get(id);
	if (!row) throw new ConvexError('INVALID_PARENT');
	if (expectedProjectId && row.projectId !== expectedProjectId)
		throw new ConvexError('INVALID_PARENT');
	await owner(ctx, row.projectId);
	if (row.deleting) throw new ConvexError('DELETING');
	return row;
}
export async function activeFeedback(
	ctx: QueryCtx,
	id: Id<'feedback'>,
	expectedProjectId?: Id<'projects'>
) {
	const row = await ctx.db.get(id);
	if (!row) throw new ConvexError('INVALID_PARENT');
	if (expectedProjectId && row.projectId !== expectedProjectId)
		throw new ConvexError('INVALID_PARENT');
	const board = await activeBoard(ctx, row.boardId);
	if (board.projectId !== row.projectId) throw new ConvexError('INVALID_PARENT');
	if (row.deleting) throw new ConvexError('DELETING');
	return row;
}
export async function activeComment(
	ctx: QueryCtx,
	id: Id<'comments'>,
	expectedFeedbackId?: Id<'feedback'>
) {
	const row = await ctx.db.get(id);
	if (!row) throw new ConvexError('INVALID_PARENT');
	if (expectedFeedbackId && row.feedbackId !== expectedFeedbackId)
		throw new ConvexError('INVALID_PARENT');
	const feedback = await activeFeedback(ctx, row.feedbackId);
	if (feedback.projectId !== row.projectId || feedback.boardId !== row.boardId)
		throw new ConvexError('INVALID_PARENT');
	if (row.deleting) throw new ConvexError('DELETING');
	return row;
}
