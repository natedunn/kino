import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalAction, internalMutation } from './_generated/server';

const stepResult = v.object({ continue: v.boolean() });

export const run = internalAction({
	args: { jobId: v.id('maintenanceJobs') },
	returns: v.null(),
	handler: async (ctx, args) => {
		try {
			const result: { continue: boolean } = await ctx.runMutation(
				internal.operationsMaintenance.step,
				args
			);
			if (result.continue)
				await ctx.scheduler.runAfter(0, internal.operationsMaintenance.run, args);
		} catch {
			await ctx.runMutation(internal.operationsMaintenance.fail, args);
		}
		return null;
	},
});

export const fail = internalMutation({
	args: { jobId: v.id('maintenanceJobs') },
	returns: v.null(),
	handler: async (ctx, { jobId }) => {
		const job = await ctx.db.get('maintenanceJobs', jobId);
		if (job && job.status !== 'completed')
			await ctx.db.patch('maintenanceJobs', jobId, {
				status: 'failed',
				updatedAt: Date.now(),
				error: 'MAINTENANCE_STEP_FAILED',
			});
		return null;
	},
});

export const step = internalMutation({
	args: { jobId: v.id('maintenanceJobs') },
	returns: stepResult,
	handler: async (ctx, { jobId }) => {
		const job = await ctx.db.get('maintenanceJobs', jobId);
		if (!job || job.status === 'completed' || job.status === 'failed') return { continue: false };
		const now = Date.now();
		if (job.status === 'pending')
			await ctx.db.patch('maintenanceJobs', jobId, { status: 'running', updatedAt: now });

		if (job.kind === 'feedback_upvotes') {
			if (!job.entityId) {
				const page = await ctx.db
					.query('feedback')
					.paginate({ cursor: job.entityCursor ?? null, numItems: 1 });
				const item: Doc<'feedback'> | undefined = page.page.at(0);
				if (!item) {
					await complete(ctx, jobId, now);
					return { continue: false };
				}
				await ctx.db.patch('maintenanceJobs', jobId, {
					entityId: item._id,
					entityCursor: page.continueCursor,
					childCursor: undefined,
					countA: 0,
					updatedAt: now,
				});
				return { continue: true };
			}

			const feedbackId = ctx.db.normalizeId('feedback', job.entityId);
			const item = feedbackId ? await ctx.db.get('feedback', feedbackId) : null;
			if (!feedbackId || !item) {
				await resetEntity(ctx, jobId, job.checked, job.changed, now);
				return { continue: true };
			}
			const page = await ctx.db
				.query('feedbackUpvotes')
				.withIndex('by_feedbackId_and_authorProfileId', (q) => q.eq('feedbackId', feedbackId))
				.paginate({ cursor: job.childCursor ?? null, numItems: 100 });
			const count = job.countA + page.page.length;
			if (!page.isDone) {
				await ctx.db.patch('maintenanceJobs', jobId, {
					childCursor: page.continueCursor,
					countA: count,
					updatedAt: now,
				});
				return { continue: true };
			}
			const changed = item.upvotes !== count;
			if (changed && !job.dryRun) await ctx.db.patch('feedback', feedbackId, { upvotes: count });
			await resetEntity(ctx, jobId, job.checked + 1, job.changed + Number(changed), now);
			return { continue: true };
		}

		if (!job.entityId) {
			const page = await ctx.db
				.query('updates')
				.paginate({ cursor: job.entityCursor ?? null, numItems: 1 });
			const item: Doc<'updates'> | undefined = page.page.at(0);
			if (!item) {
				await complete(ctx, jobId, now);
				return { continue: false };
			}
			await ctx.db.patch('maintenanceJobs', jobId, {
				entityId: item._id,
				entityCursor: page.continueCursor,
				phase: 'comments',
				childCursor: undefined,
				countA: 0,
				countB: 0,
				updatedAt: now,
			});
			return { continue: true };
		}

		const updateId = ctx.db.normalizeId('updates', job.entityId);
		const item = updateId ? await ctx.db.get('updates', updateId) : null;
		if (!updateId || !item) {
			await resetEntity(ctx, jobId, job.checked, job.changed, now);
			return { continue: true };
		}
		if (job.phase === 'comments') {
			const page = await ctx.db
				.query('updateComments')
				.withIndex('by_updateId', (q) => q.eq('updateId', updateId))
				.paginate({ cursor: job.childCursor ?? null, numItems: 100 });
			const count = job.countA + page.page.length;
			await ctx.db.patch('maintenanceJobs', jobId, {
				phase: page.isDone ? 'emotes' : 'comments',
				childCursor: page.isDone ? undefined : page.continueCursor,
				countA: count,
				updatedAt: now,
			});
			return { continue: true };
		}
		const page = await ctx.db
			.query('updateEmotes')
			.withIndex('by_updateId_and_authorProfileId_and_content', (q) => q.eq('updateId', updateId))
			.paginate({ cursor: job.childCursor ?? null, numItems: 100 });
		const hearts = job.countB + page.page.filter((emote) => emote.content === 'heart').length;
		if (!page.isDone) {
			await ctx.db.patch('maintenanceJobs', jobId, {
				childCursor: page.continueCursor,
				countB: hearts,
				updatedAt: now,
			});
			return { continue: true };
		}
		const changed = item.commentCount !== job.countA || item.heartCount !== hearts;
		if (changed && !job.dryRun)
			await ctx.db.patch('updates', updateId, {
				commentCount: job.countA,
				heartCount: hearts,
			});
		await resetEntity(ctx, jobId, job.checked + 1, job.changed + Number(changed), now);
		return { continue: true };
	},
});

async function complete(ctx: MutationCtx, jobId: Id<'maintenanceJobs'>, now: number) {
	await ctx.db.patch('maintenanceJobs', jobId, {
		status: 'completed',
		updatedAt: now,
		completedAt: now,
		entityId: undefined,
		childCursor: undefined,
		phase: undefined,
	});
}

async function resetEntity(
	ctx: MutationCtx,
	jobId: Id<'maintenanceJobs'>,
	checked: number,
	changed: number,
	now: number
) {
	await ctx.db.patch('maintenanceJobs', jobId, {
		entityId: undefined,
		childCursor: undefined,
		phase: undefined,
		countA: 0,
		countB: 0,
		checked,
		changed,
		updatedAt: now,
	});
}
