import type { Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

import { makeFunctionReference } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { internalAction, internalMutation, mutation, query } from './_generated/server';

const runRef = makeFunctionReference<'action'>('files:run');
const claimRef = makeFunctionReference<'mutation'>('files:claim');
const ackRef = makeFunctionReference<'mutation'>('files:ack');
const failRef = makeFunctionReference<'mutation'>('files:fail');
const UPLOAD_SETTLE_GRACE_MS = 30_000;
async function authorize(ctx: MutationCtx | QueryCtx, tenantId: Id<'tenants'>) {
	const tenant = await ctx.db.get(tenantId);
	if (!tenant || (await ctx.auth.getUserIdentity())?.subject !== tenant.owner)
		throw new ConvexError('FORBIDDEN');
	return tenant;
}
// Trusted upload completion only: a public client must never choose its byte count or object key.
export const register = internalMutation({
	args: { tenantId: v.id('tenants'), name: v.string(), bytes: v.number(), pending: v.boolean() },
	handler: async (ctx, a) => {
		if (!Number.isSafeInteger(a.bytes) || a.bytes < 0) throw new Error('INVALID_SIZE');
		const tenant = await ctx.db.get(a.tenantId);
		if (!tenant) throw new Error('MISSING_TENANT');
		const id = await ctx.db.insert('assets', {
			tenantId: a.tenantId,
			name: a.name,
			publicId: '',
			bytes: a.bytes,
			key: '',
			state: a.pending ? 'pending' : 'ready',
			accounting: a.pending ? 'reserved' : 'used',
		});
		// Immutable, never reused even when the display filename is the same.
		const key = `proof/${a.tenantId}/${id}`;
		const publicId = String(id);
		await ctx.db.patch(id, { key, publicId });
		await ctx.db.patch(
			tenant._id,
			a.pending
				? { reserved: tenant.reserved + a.bytes }
				: { used: tenant.used + a.bytes, count: tenant.count + 1 }
		);
		return { id, key, publicId };
	},
});
export const beginUpload = mutation({
	args: {
		tenantId: v.id('tenants'),
		name: v.string(),
		bytes: v.number(),
		ttlMs: v.number(),
	},
	handler: async (ctx, a) => {
		const tenant = await authorize(ctx, a.tenantId);
		if (!a.name || !Number.isSafeInteger(a.bytes) || a.bytes <= 0)
			throw new ConvexError('INVALID_UPLOAD');
		if (!Number.isSafeInteger(a.ttlMs) || a.ttlMs < 1_000 || a.ttlMs > 300_000)
			throw new ConvexError('INVALID_TTL');
		const assetId = await ctx.db.insert('assets', {
			tenantId: a.tenantId,
			name: a.name,
			publicId: '',
			key: '',
			bytes: a.bytes,
			state: 'pending',
			accounting: 'reserved',
		});
		const expiresAt = Date.now() + a.ttlMs;
		const grantId = await ctx.db.insert('uploadGrants', {
			assetId,
			tenantId: a.tenantId,
			stagingKey: '',
			state: 'open',
			expiresAt,
			settleAfter: expiresAt + UPLOAD_SETTLE_GRACE_MS,
		});
		const key = `proof/${a.tenantId}/${assetId}`;
		const stagingKey = `proof-staging/${a.tenantId}/${grantId}`;
		const publicId = String(assetId);
		await ctx.db.patch(assetId, { key, publicId, uploadGrantId: grantId });
		await ctx.db.patch(grantId, { stagingKey });
		await ctx.db.patch(tenant._id, { reserved: tenant.reserved + a.bytes });
		return { assetId, grantId, key, stagingKey, expiresAt, publicId };
	},
});
// Called only after trusted storage code verifies the staged object's exact size
// and promotes it to the immutable final key.
export const commitUpload = internalMutation({
	args: { grantId: v.id('uploadGrants'), actualBytes: v.number() },
	handler: async (ctx, a) => {
		const grant = await ctx.db.get(a.grantId);
		if (!grant || grant.state !== 'open' || Date.now() > grant.expiresAt)
			throw new ConvexError('UPLOAD_CLOSED');
		const asset = await ctx.db.get(grant.assetId);
		const tenant = await ctx.db.get(grant.tenantId);
		if (!asset || !tenant || asset.state !== 'pending' || asset.uploadGrantId !== grant._id)
			throw new ConvexError('UPLOAD_CLOSED');
		if (a.actualBytes !== asset.bytes) throw new ConvexError('INVALID_SIZE');
		if (tenant.reserved < asset.bytes) throw new Error('QUOTA_UNDERFLOW');
		await ctx.db.patch(tenant._id, {
			reserved: tenant.reserved - asset.bytes,
			used: tenant.used + asset.bytes,
			count: tenant.count + 1,
		});
		await ctx.db.patch(asset._id, { state: 'ready', accounting: 'used' });
		await ctx.db.patch(grant._id, { state: 'completed' });
		return null;
	},
});
export const read = query({
	args: { assetId: v.id('assets') },
	handler: async (ctx, a) => {
		const asset = await ctx.db.get(a.assetId);
		if (!asset) return null;
		await authorize(ctx, asset.tenantId);
		return asset.state === 'ready' ? asset : null;
	},
});
export const attach = mutation({
	args: { assetId: v.id('assets') },
	handler: async (ctx, a) => {
		const asset = await ctx.db.get(a.assetId);
		if (!asset) throw new Error('MISSING');
		await authorize(ctx, asset.tenantId);
		if (asset.state !== 'ready') throw new ConvexError('UNAVAILABLE');
		return ctx.db.insert('references', { assetId: asset._id });
	},
});
export const remove = mutation({
	args: { assetId: v.id('assets') },
	handler: async (ctx, a) => {
		const asset = await ctx.db.get(a.assetId);
		if (!asset) throw new Error('MISSING');
		await authorize(ctx, asset.tenantId);
		if (asset.jobId) return asset.jobId;
		if (
			await ctx.db
				.query('references')
				.withIndex('by_asset', (q) => q.eq('assetId', asset._id))
				.first()
		)
			throw new ConvexError('FILE_IN_USE');
		const grant = asset.uploadGrantId ? await ctx.db.get(asset.uploadGrantId) : null;
		const notBefore = grant?.state === 'open' ? grant.settleAfter : Date.now();
		if (grant?.state === 'open') await ctx.db.patch(grant._id, { state: 'revoked' });
		const keys = [asset.key];
		if (grant?.stagingKey) keys.push(grant.stagingKey);
		keys.push(`${asset.key}.thumbnail`, `${asset.key}.public`);
		const jobId = await ctx.db.insert('cleanup', {
			assetId: asset._id,
			tenantId: asset.tenantId,
			keys,
			cacheTag: `kino-file-${asset.publicId}`,
			notBefore,
			bytes: asset.bytes,
			accounting: asset.accounting,
			state: 'pending',
			attempt: 0,
			maxAttempt: 3,
			leaseUntil: 0,
		});
		await ctx.db.patch(asset._id, { state: 'deleting', jobId });
		await ctx.scheduler.runAfter(0, runRef, { jobId });
		return jobId;
	},
});
export const claim = internalMutation({
	args: { jobId: v.id('cleanup') },
	handler: async (ctx, a) => {
		const job = await ctx.db.get(a.jobId);
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
		const attempt = job.attempt + 1,
			leaseUntil = Date.now() + 30_000;
		await ctx.db.patch(job._id, { state: 'running', attempt, leaseUntil });
		// Crash recovery is scheduled atomically with claiming the attempt.
		await ctx.scheduler.runAfter(30_000, runRef, { jobId: job._id });
		return { ...job, attempt };
	},
});
export const ack = internalMutation({
	args: { jobId: v.id('cleanup'), attempt: v.number() },
	handler: async (ctx, a) => {
		const job = await ctx.db.get(a.jobId);
		if (!job || job.state !== 'running' || job.attempt !== a.attempt) return null;
		const tenant = await ctx.db.get(job.tenantId),
			asset = await ctx.db.get(job.assetId);
		if (
			!tenant ||
			!asset ||
			asset.jobId !== job._id ||
			!job.keys.includes(asset.key) ||
			asset.state !== 'deleting'
		)
			throw new Error('CLEANUP_INVARIANT');
		if (job.accounting === 'used') {
			if (tenant.used < job.bytes || tenant.count < 1) throw new Error('QUOTA_UNDERFLOW');
			await ctx.db.patch(tenant._id, { used: tenant.used - job.bytes, count: tenant.count - 1 });
		} else {
			if (tenant.reserved < job.bytes) throw new Error('QUOTA_UNDERFLOW');
			await ctx.db.patch(tenant._id, { reserved: tenant.reserved - job.bytes });
		}
		await ctx.db.patch(asset._id, { state: 'deleted' });
		await ctx.db.patch(job._id, { state: 'done', lastError: undefined });
		return null;
	},
});
export const fail = internalMutation({
	args: { jobId: v.id('cleanup'), attempt: v.number() },
	handler: async (ctx, a) => {
		const job = await ctx.db.get(a.jobId);
		if (!job || job.state !== 'running' || job.attempt !== a.attempt) return null;
		await ctx.db.patch(job._id, { lastError: 'DELETE_OR_ACK_FAILED' });
		return null;
	},
});
export const resume = mutation({
	args: { jobId: v.id('cleanup') },
	handler: async (ctx, a) => {
		const job = await ctx.db.get(a.jobId);
		if (!job) throw new Error('MISSING');
		await authorize(ctx, job.tenantId);
		if (job.state === 'done') return null;
		if (job.state === 'failed')
			await ctx.db.patch(job._id, {
				state: 'pending',
				leaseUntil: 0,
				maxAttempt: job.attempt + 3,
				lastError: undefined,
			});
		// Keep attempt monotonic so stale acknowledgements can never match a new attempt.
		await ctx.scheduler.runAfter(0, runRef, { jobId: job._id });
		return null;
	},
});
export const run = internalAction({
	args: { jobId: v.id('cleanup') },
	handler: async (ctx, a) => {
		const job = await ctx.runMutation(claimRef, a);
		if (!job) return null;
		try {
			const endpoint = process.env.PROOF_STORAGE_DELETE_URL,
				token = process.env.PROOF_STORAGE_DELETE_TOKEN;
			if (!endpoint || !token) throw new Error('Storage transport not configured');
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
				body: JSON.stringify({ keys: job.keys, cacheTag: job.cacheTag }),
			});
			if (!response.ok) throw new Error('Delete failed');
			await ctx.runMutation(ackRef, { jobId: job._id, attempt: job.attempt });
		} catch {
			await ctx.runMutation(failRef, { jobId: job._id, attempt: job.attempt });
		}
		return null;
	},
});
