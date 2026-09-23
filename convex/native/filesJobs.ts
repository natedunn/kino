import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation, mutation, query } from './_generated/server';
import { requireProjectAccess } from './access';
import { account } from './files.lib';
import schema from './schema';

export const claim = internalMutation({
	args: { jobId: v.id('storageCleanupJobs') },
	returns: v.union(
		v.null(),
		v.object({
			job: schema.doc('storageCleanupJobs'),
			keys: v.array(v.string()),
			publicId: v.string(),
		})
	),
	handler: async (ctx, args) => {
		const job = await ctx.db.get('storageCleanupJobs', args.jobId);
		if (
			!job ||
			job.state === 'done' ||
			job.state === 'failed' ||
			(job.state === 'running' && job.leaseUntil > Date.now())
		)
			return null;
		if (job.notBefore > Date.now()) {
			await ctx.scheduler.runAfter(
				job.notBefore - Date.now(),
				internal.filesTransport.cleanup,
				args
			);
			return null;
		}
		if (job.attempt >= job.maxAttempt) {
			await ctx.db.patch('storageCleanupJobs', job._id, { state: 'failed' });
			return null;
		}
		const object = await ctx.db.get('fileObjects', job.objectId);
		const asset = object ? await ctx.db.get('fileAssets', object.assetId) : null;
		if (!object || !asset) throw new Error('STORAGE_CLEANUP_INVARIANT');
		const next = {
			...job,
			state: 'running' as const,
			attempt: job.attempt + 1,
			leaseUntil: Date.now() + 120_000,
		};
		await ctx.db.patch('storageCleanupJobs', job._id, {
			state: next.state,
			attempt: next.attempt,
			leaseUntil: next.leaseUntil,
		});
		await ctx.scheduler.runAfter(120_000, internal.filesTransport.cleanup, args);
		return {
			job: next,
			publicId: asset.publicId,
			keys: job.stagingOnly
				? [object.stagingKey]
				: [object.stagingKey, object.key, `NATIVE_THUMB.${asset.publicId}.webp`],
		};
	},
});
export const acknowledge = internalMutation({
	args: { jobId: v.id('storageCleanupJobs'), attempt: v.number() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const job = await ctx.db.get('storageCleanupJobs', args.jobId);
		if (!job || job.state !== 'running' || job.attempt !== args.attempt) return null;
		if (!job.stagingOnly) {
			const object = await ctx.db.get('fileObjects', job.objectId);
			const asset = object ? await ctx.db.get('fileAssets', object.assetId) : null;
			if (!object || !asset || object.state !== 'deleting' || asset.state !== 'deleting')
				throw new Error('STORAGE_CLEANUP_INVARIANT');
			await account(ctx, asset, object, 'release');
			await ctx.db.patch('fileObjects', object._id, { state: 'deleted' });
			await ctx.db.patch('fileAssets', asset._id, {
				state: 'deleted',
				coverUpdateId: undefined,
				updatedAt: Date.now(),
			});
		}
		await ctx.db.patch('storageCleanupJobs', job._id, {
			state: 'done',
			lastError: undefined,
			finishedAt: Date.now(),
		});
		await ctx.scheduler.runAfter(0, internal.filesProjectPurge.batch, { projectId: job.projectId });
		await ctx.scheduler.runAfter(0, internal.projectDeletion.batch, { projectId: job.projectId });
		return null;
	},
});
export const fail = internalMutation({
	args: { jobId: v.id('storageCleanupJobs'), attempt: v.number() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const job = await ctx.db.get('storageCleanupJobs', args.jobId);
		if (job?.state === 'running' && job.attempt === args.attempt)
			await ctx.db.patch('storageCleanupJobs', job._id, { lastError: 'DELETE_OR_PURGE_FAILED' });
		return null;
	},
});
export const list = query({
	args: {
		projectId: v.id('projects'),
		state: v.union(
			v.literal('pending'),
			v.literal('running'),
			v.literal('failed'),
			v.literal('done')
		),
		paginationOpts: paginationOptsValidator,
	},
	returns: paginationResultValidator(schema.doc('storageCleanupJobs')),
	handler: async (ctx, args) => {
		const access = await requireProjectAccess(ctx, args.projectId, true);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		return ctx.db
			.query('storageCleanupJobs')
			.withIndex('by_projectId_and_state', (q) =>
				q.eq('projectId', args.projectId).eq('state', args.state)
			)
			.paginate(args.paginationOpts);
	},
});
export const resume = mutation({
	args: { jobId: v.id('storageCleanupJobs') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const job = await ctx.db.get('storageCleanupJobs', args.jobId);
		if (!job) throw new ConvexError('JOB_NOT_FOUND');
		const access = await requireProjectAccess(ctx, job.projectId, true);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		if (job.state === 'failed') {
			await ctx.db.patch('storageCleanupJobs', job._id, {
				state: 'pending',
				leaseUntil: 0,
				maxAttempt: job.attempt + 3,
				lastError: undefined,
			});
			await ctx.scheduler.runAfter(0, internal.filesTransport.cleanup, args);
		}
		return null;
	},
});
