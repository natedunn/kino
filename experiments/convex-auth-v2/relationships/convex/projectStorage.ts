import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

import { makeFunctionReference } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { internalAction, internalMutation, mutation } from './_generated/server';
import { owner } from './lifecycle';

const runRef = makeFunctionReference<'action'>('projectStorage:run');
const projectStepRef = makeFunctionReference<'mutation'>('lifecycle:step');
const claimRef = makeFunctionReference<'mutation'>('projectStorage:claim');
const ackRef = makeFunctionReference<'mutation'>('projectStorage:ack');
const failRef = makeFunctionReference<'mutation'>('projectStorage:fail');

export const createAsset = mutation({
	args: { projectId: v.id('projects'), size: v.number(), publicId: v.string() },
	handler: async (ctx, args) => {
		await owner(ctx, args.projectId);
		if (!Number.isSafeInteger(args.size) || args.size <= 0 || !/^[a-f0-9]{32}$/.test(args.publicId))
			throw new ConvexError('INVALID_FILE');
		let usage = await ctx.db
			.query('projectStorageUsage')
			.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
			.unique();
		if (!usage) {
			const usageId = await ctx.db.insert('projectStorageUsage', {
				projectId: args.projectId,
				usedBytes: 0,
				reservedBytes: 0,
				fileCount: 0,
			});
			usage = (await ctx.db.get(usageId))!;
		}
		const assetId = await ctx.db.insert('fileAssets', {
			projectId: args.projectId,
			publicId: args.publicId,
			size: args.size,
			state: 'ready',
		});
		const keys = [
			[`PRIVATE.${assetId}`, 'original'],
			[`PUBLIC_FILE.${args.publicId}`, 'public'],
			[`PUBLIC_FILE_THUMBNAIL.${args.publicId}.webp`, 'thumbnail'],
		] as const;
		for (const [key, kind] of keys)
			await ctx.db.insert('fileObjects', { projectId: args.projectId, assetId, key, kind });
		await ctx.db.patch(usage._id, {
			usedBytes: usage.usedBytes + args.size,
			fileCount: usage.fileCount + 1,
		});
		return assetId;
	},
});

export const createPendingAsset = mutation({
	args: { projectId: v.id('projects'), size: v.number(), publicId: v.string(), ttlMs: v.number() },
	handler: async (ctx, args) => {
		await owner(ctx, args.projectId);
		if (
			!Number.isSafeInteger(args.size) ||
			args.size <= 0 ||
			!Number.isSafeInteger(args.ttlMs) ||
			args.ttlMs < 1_000 ||
			args.ttlMs > 300_000 ||
			!/^[a-f0-9]{32}$/.test(args.publicId)
		)
			throw new ConvexError('INVALID_FILE');
		let usage = await ctx.db
			.query('projectStorageUsage')
			.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
			.unique();
		if (!usage) {
			const usageId = await ctx.db.insert('projectStorageUsage', {
				projectId: args.projectId,
				usedBytes: 0,
				reservedBytes: 0,
				fileCount: 0,
			});
			usage = (await ctx.db.get(usageId))!;
		}
		const settleAfter = Date.now() + args.ttlMs + 30_000;
		const assetId = await ctx.db.insert('fileAssets', {
			projectId: args.projectId,
			publicId: args.publicId,
			size: args.size,
			state: 'pending',
			settleAfter,
		});
		for (const [key, kind] of [
			[`STAGING.${assetId}`, 'original'],
			[`PUBLIC_FILE.${args.publicId}`, 'public'],
			[`PUBLIC_FILE_THUMBNAIL.${args.publicId}.webp`, 'thumbnail'],
		] as const)
			await ctx.db.insert('fileObjects', { projectId: args.projectId, assetId, key, kind });
		await ctx.db.patch(usage._id, { reservedBytes: usage.reservedBytes + args.size });
		return { assetId, settleAfter };
	},
});

export async function scheduleAssetCleanup(
	ctx: MutationCtx,
	projectJobId: Id<'jobs'>,
	assetId: Id<'fileAssets'>
) {
	const asset = await ctx.db.get(assetId);
	if (!asset || asset.cleanupJobId) return asset?.cleanupJobId ?? null;
	const objects = await ctx.db
		.query('fileObjects')
		.withIndex('by_assetId', (q) => q.eq('assetId', asset._id))
		.take(10);
	const cleanupJobId = await ctx.db.insert('storageCleanupJobs', {
		projectId: asset.projectId,
		projectJobId,
		assetId: asset._id,
		keys: objects.map((object) => object.key),
		cacheTag: `kino-file-${asset.publicId}`,
		accounting: asset.state === 'pending' ? 'reserved' : 'used',
		notBefore: asset.settleAfter ?? Date.now(),
		state: 'pending',
		attempt: 0,
		maxAttempt: 3,
		leaseUntil: 0,
	});
	await ctx.db.patch(asset._id, { state: 'deleting', cleanupJobId });
	await ctx.scheduler.runAfter(0, runRef, { jobId: cleanupJobId });
	return cleanupJobId;
}

export const claim = internalMutation({
	args: { jobId: v.id('storageCleanupJobs') },
	handler: async (ctx, args) => {
		const job = await ctx.db.get(args.jobId);
		if (
			!job ||
			job.state === 'done' ||
			job.state === 'failed' ||
			(job.state === 'running' && job.leaseUntil > Date.now())
		)
			return null;
		if (Date.now() < job.notBefore) {
			await ctx.scheduler.runAfter(job.notBefore - Date.now(), runRef, { jobId: job._id });
			return null;
		}
		if (job.attempt >= job.maxAttempt) {
			await ctx.db.patch(job._id, { state: 'failed', lastError: 'RETRY_LIMIT' });
			return null;
		}
		const attempt = job.attempt + 1;
		await ctx.db.patch(job._id, { state: 'running', attempt, leaseUntil: Date.now() + 30_000 });
		await ctx.scheduler.runAfter(30_000, runRef, { jobId: job._id });
		return { ...job, attempt };
	},
});

export const ack = internalMutation({
	args: { jobId: v.id('storageCleanupJobs'), attempt: v.number() },
	handler: async (ctx, args) => {
		const job = await ctx.db.get(args.jobId);
		if (!job || job.state !== 'running' || job.attempt !== args.attempt) return null;
		const asset = await ctx.db.get(job.assetId);
		const usage = await ctx.db
			.query('projectStorageUsage')
			.withIndex('by_projectId', (q) => q.eq('projectId', job.projectId))
			.unique();
		if (!asset || !usage || asset.cleanupJobId !== job._id || asset.state !== 'deleting')
			throw new Error('STORAGE_CLEANUP_INVARIANT');
		if (job.accounting === 'used') {
			if (usage.usedBytes < asset.size || usage.fileCount < 1)
				throw new Error('STORAGE_ACCOUNTING_UNDERFLOW');
			await ctx.db.patch(usage._id, {
				usedBytes: usage.usedBytes - asset.size,
				fileCount: usage.fileCount - 1,
			});
		} else {
			if (usage.reservedBytes < asset.size) throw new Error('STORAGE_ACCOUNTING_UNDERFLOW');
			await ctx.db.patch(usage._id, { reservedBytes: usage.reservedBytes - asset.size });
		}
		await ctx.db.patch(asset._id, { state: 'deleted' });
		await ctx.db.patch(job._id, { state: 'done', lastError: undefined });
		const projectJob = await ctx.db.get(job.projectJobId);
		if (projectJob && !projectJob.done)
			await ctx.scheduler.runAfter(0, projectStepRef, {
				jobId: projectJob._id,
				version: projectJob.version,
			});
		return null;
	},
});

export const fail = internalMutation({
	args: { jobId: v.id('storageCleanupJobs'), attempt: v.number() },
	handler: async (ctx, args) => {
		const job = await ctx.db.get(args.jobId);
		if (!job || job.state !== 'running' || job.attempt !== args.attempt) return null;
		await ctx.db.patch(job._id, { lastError: 'DELETE_OR_PURGE_FAILED' });
		return null;
	},
});

export const run = internalAction({
	args: { jobId: v.id('storageCleanupJobs') },
	handler: async (ctx, args) => {
		const job = await ctx.runMutation(claimRef, args);
		if (!job) return null;
		try {
			const endpoint = process.env.PROOF_STORAGE_DELETE_URL;
			const token = process.env.PROOF_STORAGE_DELETE_TOKEN;
			if (!endpoint || !token) throw new Error('Storage transport not configured');
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
				body: JSON.stringify({ keys: job.keys, cacheTag: job.cacheTag }),
			});
			if (!response.ok) throw new Error('Cleanup failed');
			await ctx.runMutation(ackRef, { jobId: job._id, attempt: job.attempt });
		} catch {
			await ctx.runMutation(failRef, { jobId: job._id, attempt: job.attempt });
		}
		return null;
	},
});

export async function resumeProjectStorage(ctx: MutationCtx, projectId: Id<'projects'>) {
	for (const state of ['failed', 'pending', 'running'] as const) {
		const jobs = await ctx.db
			.query('storageCleanupJobs')
			.withIndex('by_projectId_state', (q) => q.eq('projectId', projectId).eq('state', state))
			.take(25);
		for (const job of jobs) {
			if (job.state === 'failed')
				await ctx.db.patch(job._id, {
					state: 'pending',
					leaseUntil: 0,
					maxAttempt: job.attempt + 3,
					lastError: undefined,
				});
			await ctx.scheduler.runAfter(0, runRef, { jobId: job._id });
		}
	}
}
