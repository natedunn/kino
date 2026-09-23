import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

import { makeFunctionReference } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { internalMutation, mutation } from './_generated/server';
import { activeBoard, activeComment, activeFeedback, BATCH_SIZE, owner } from './lifecycle';

const kind = v.union(v.literal('board'), v.literal('feedback'), v.literal('comment'));
const stepRef = makeFunctionReference<'mutation'>('branchDeletion:step');
const leafStages = ['reactions', 'votes', 'events', 'links', 'comments'] as const;
async function schedule(ctx: MutationCtx, jobId: Id<'branchJobs'>, version: number) {
	const scheduledId = await ctx.scheduler.runAfter(0, stepRef, { jobId, version });
	await ctx.db.patch(jobId, { scheduledId });
}
export const begin = mutation({
	args: { kind, rootId: v.string() },
	handler: async (ctx, args) => {
		const table =
			args.kind === 'board' ? 'boards' : args.kind === 'feedback' ? 'feedback' : 'comments';
		const id = ctx.db.normalizeId(table, args.rootId);
		const root = id && (await ctx.db.get(id));
		if (!root) throw new ConvexError('INVALID_PARENT');
		const project = await owner(ctx, root.projectId, true);
		const existing = await ctx.db
			.query('branchJobs')
			.withIndex('by_kind_rootId', (q) => q.eq('kind', args.kind).eq('rootId', args.rootId))
			.unique();
		if (existing) return existing._id;
		if (args.kind === 'board') await activeBoard(ctx, id as Id<'boards'>);
		if (args.kind === 'feedback') await activeFeedback(ctx, id as Id<'feedback'>);
		if (args.kind === 'comment') {
			const comment = await activeComment(ctx, id as Id<'comments'>);
			if (comment.initial) throw new ConvexError('INITIAL_COMMENT');
		}
		await ctx.db.patch(root._id, { deleting: true });
		const jobId = await ctx.db.insert('branchJobs', {
			projectId: root.projectId,
			ownerId: project.ownerId,
			...args,
			phase: 0,
			version: 0,
			processed: 0,
			done: false,
		});
		await schedule(ctx, jobId, 0);
		return jobId;
	},
});
export const step = internalMutation({
	args: { jobId: v.id('branchJobs'), version: v.number() },
	handler: async (ctx, args) => {
		const job = await ctx.db.get(args.jobId);
		if (!job || job.done || job.version !== args.version) return null;
		const table =
			job.kind === 'board' ? 'boards' : job.kind === 'feedback' ? 'feedback' : 'comments';
		const id = ctx.db.normalizeId(table, job.rootId);
		const root = id && (await ctx.db.get(id));
		if (!root) {
			await ctx.db.patch(job._id, { done: true, version: job.version + 1 });
			return null;
		}
		if (!root.deleting || root.projectId !== job.projectId)
			throw new ConvexError('INVALID_DELETION_FENCE');
		let count = 0;
		let phases = 0;
		if (job.kind === 'comment') {
			phases = 4;
			const commentId = id as Id<'comments'>;
			if (job.phase === 0) {
				const rows = await ctx.db
					.query('reactions')
					.withIndex('by_commentId', (q) => q.eq('commentId', commentId))
					.take(BATCH_SIZE);
				for (const row of rows) await ctx.db.delete(row._id);
				count = rows.length;
			}
			if (job.phase === 1) {
				const rows = await ctx.db
					.query('comments')
					.withIndex('by_replyId', (q) => q.eq('replyId', commentId))
					.take(BATCH_SIZE);
				for (const row of rows) await ctx.db.patch(row._id, { replyId: undefined });
				count = rows.length;
			}
			if (job.phase === 2) {
				const rows = await ctx.db
					.query('feedback')
					.withIndex('by_answerId', (q) => q.eq('answerId', commentId))
					.take(BATCH_SIZE);
				for (const row of rows) await ctx.db.patch(row._id, { answerId: undefined });
				count = rows.length;
			}
			if (job.phase === 3) {
				const rows = await ctx.db
					.query('feedback')
					.withIndex('by_firstCommentId', (q) => q.eq('firstCommentId', commentId))
					.take(BATCH_SIZE);
				for (const row of rows) await ctx.db.patch(row._id, { firstCommentId: undefined });
				count = rows.length;
			}
		} else {
			phases = job.kind === 'board' ? 6 : 5;
			const leaf = leafStages[job.phase];
			if (leaf) {
				const rows =
					job.kind === 'board'
						? await ctx.db
								.query(leaf)
								.withIndex('by_boardId', (q) => q.eq('boardId', id as Id<'boards'>))
								.take(BATCH_SIZE)
						: await ctx.db
								.query(leaf)
								.withIndex('by_feedbackId', (q) => q.eq('feedbackId', id as Id<'feedback'>))
								.take(BATCH_SIZE);
				for (const row of rows) await ctx.db.delete(row._id);
				count = rows.length;
			} else if (job.kind === 'board' && job.phase === 5) {
				const rows = await ctx.db
					.query('feedback')
					.withIndex('by_boardId', (q) => q.eq('boardId', id as Id<'boards'>))
					.take(BATCH_SIZE);
				for (const row of rows) await ctx.db.delete(row._id);
				count = rows.length;
			}
		}
		if (job.phase >= phases) {
			await ctx.db.delete(root._id);
			await ctx.db.patch(job._id, { done: true, version: job.version + 1 });
			return null;
		}
		const version = job.version + 1;
		await ctx.db.patch(job._id, {
			version,
			phase: job.phase + (count < BATCH_SIZE ? 1 : 0),
			processed: job.processed + count,
		});
		await schedule(ctx, job._id, version);
		return null;
	},
});
export const resume = mutation({
	args: { jobId: v.id('branchJobs') },
	handler: async (ctx, args) => {
		const job = await ctx.db.get(args.jobId);
		if (!job) throw new ConvexError('FORBIDDEN');
		const project = await owner(ctx, job.projectId, true);
		if (project.ownerId !== job.ownerId) throw new ConvexError('FORBIDDEN');
		if (!job.done) await schedule(ctx, job._id, job.version);
		return null;
	},
});
