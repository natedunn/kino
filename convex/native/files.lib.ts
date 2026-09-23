import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

import { RateLimiter } from '@convex-dev/rate-limiter';
import { ConvexError } from 'convex/values';

import { getProjectStorageLimitBytes } from '../shared/files';
import { components, internal } from './_generated/api';
import { assertProjectWritable, requireProjectAccess, resolveProjectAccess } from './access';
import { getCurrentUser, requireCurrentUser } from './identity';

const limits = new RateLimiter(components.authLimits, {
	fileWrite: { kind: 'token bucket', rate: 60, period: 60_000, capacity: 60 },
});
export async function manageFiles(ctx: MutationCtx, projectId: Id<'projects'>) {
	const user = await requireCurrentUser(ctx);
	const access = await requireProjectAccess(ctx, projectId);
	assertProjectWritable(access);
	if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
	if (access.project.storageDeletingAt !== undefined) throw new ConvexError('PROJECT_NOT_FOUND');
	if (!(await limits.limit(ctx, 'fileWrite', { key: user._id })).ok)
		throw new ConvexError('RATE_LIMITED');
	return { user, project: access.project };
}
export async function readFile(ctx: QueryCtx, assetId: Id<'fileAssets'>) {
	const asset = await ctx.db.get('fileAssets', assetId);
	if (!asset || asset.state !== 'ready') throw new ConvexError('FILE_NOT_FOUND');
	const access = await viewFilesProject(ctx, asset.projectId);
	const user = await getCurrentUser(ctx);
	if (
		asset.access === 'private_user'
			? user?._id !== asset.uploaderId
			: asset.access === 'project_staff' && !access.permissions.canManageContent
	)
		throw new ConvexError('FORBIDDEN');
	if (asset.coverUpdateId) {
		const update = await ctx.db.get('updates', asset.coverUpdateId);
		if (
			!update ||
			update.deletingAt !== undefined ||
			(update.status === 'draft' && !access.permissions.canManageContent)
		)
			throw new ConvexError('FILE_NOT_FOUND');
	}
	return asset;
}
export async function viewFilesProject(ctx: QueryCtx, projectId: Id<'projects'>) {
	const access = await resolveProjectAccess(ctx, projectId);
	if (!access.project || access.project.storageDeletingAt !== undefined)
		throw new ConvexError('PROJECT_NOT_FOUND');
	return { ...access, project: access.project };
}
export function usageFor(ctx: Pick<QueryCtx, 'db'>, projectId: Id<'projects'>) {
	return ctx.db
		.query('storageUsage')
		.withIndex('by_projectId', (q) => q.eq('projectId', projectId))
		.unique();
}
export async function reserve(ctx: MutationCtx, project: Doc<'projects'>, bytes: number) {
	const usage = await usageFor(ctx, project._id);
	if ((usage?.usedBytes ?? 0) + (usage?.reservedBytes ?? 0) + bytes > getProjectStorageLimitBytes())
		throw new ConvexError('FILE_STORAGE_LIMIT');
	if (usage)
		await ctx.db.patch('storageUsage', usage._id, { reservedBytes: usage.reservedBytes + bytes });
	else
		await ctx.db.insert('storageUsage', {
			projectId: project._id,
			organizationId: project.organizationId,
			usedBytes: 0,
			reservedBytes: bytes,
			fileCount: 0,
			byCategory: {},
			byOrigin: {},
			byUploaderClass: {},
		});
}
function dimension(
	current: Record<string, { bytes: number; files: number }>,
	key: string,
	bytes: number,
	files: number
) {
	const old = current[key] ?? { bytes: 0, files: 0 };
	const value = { bytes: old.bytes + bytes, files: old.files + files };
	if (value.bytes < 0 || value.files < 0) throw new Error('STORAGE_ACCOUNTING_UNDERFLOW');
	const next = { ...current, [key]: value };
	if (!value.bytes && !value.files) delete next[key];
	return next;
}
export async function account(
	ctx: MutationCtx,
	asset: Doc<'fileAssets'>,
	object: Doc<'fileObjects'>,
	operation: 'commit' | 'release',
	actualBytes = 0
) {
	const usage = await usageFor(ctx, asset.projectId);
	if (!usage) throw new Error('STORAGE_RESERVATION_MISSING');
	if (object.accounting === 'released' || (operation === 'commit' && object.accounting === 'used'))
		return;
	const reservedDelta = object.accounting === 'reserved' ? -object.declaredBytes : 0;
	const bytes =
		operation === 'commit'
			? actualBytes
			: object.accounting === 'used'
				? -(object.actualBytes ?? 0)
				: 0;
	const count = operation === 'commit' ? 1 : object.accounting === 'used' ? -1 : 0;
	if (
		usage.reservedBytes + reservedDelta < 0 ||
		usage.usedBytes + bytes < 0 ||
		usage.fileCount + count < 0
	)
		throw new Error('STORAGE_ACCOUNTING_UNDERFLOW');
	await ctx.db.patch('storageUsage', usage._id, {
		reservedBytes: usage.reservedBytes + reservedDelta,
		usedBytes: usage.usedBytes + bytes,
		fileCount: usage.fileCount + count,
		byCategory: dimension(usage.byCategory, asset.category, bytes, count),
		byOrigin: dimension(usage.byOrigin, asset.origin, bytes, count),
		byUploaderClass: dimension(usage.byUploaderClass, asset.uploaderClass, bytes, count),
	});
	await ctx.db.patch('fileObjects', object._id, {
		accounting: operation === 'commit' ? 'used' : 'released',
	});
}
export async function enqueueCleanup(
	ctx: MutationCtx,
	object: Doc<'fileObjects'>,
	stagingOnly = false
) {
	const existing = await ctx.db
		.query('storageCleanupJobs')
		.withIndex('by_objectId_and_stagingOnly', (q) =>
			q.eq('objectId', object._id).eq('stagingOnly', stagingOnly)
		)
		.unique();
	if (existing) return existing._id;
	if (!stagingOnly) {
		await ctx.db.patch('fileAssets', object.assetId, { state: 'deleting', updatedAt: Date.now() });
		await ctx.db.patch('fileObjects', object._id, { state: 'deleting' });
	}
	const notBefore = Math.max(Date.now(), object.settleAfter);
	const jobId = await ctx.db.insert('storageCleanupJobs', {
		projectId: object.projectId,
		objectId: object._id,
		state: 'pending',
		attempt: 0,
		maxAttempt: 3,
		leaseUntil: 0,
		notBefore,
		stagingOnly,
	});
	await ctx.scheduler.runAfter(notBefore - Date.now(), internal.filesTransport.cleanup, { jobId });
	return jobId;
}
export async function detachUpdateFiles(
	ctx: MutationCtx,
	updateId: Id<'updates'>,
	keepAssetId?: Id<'fileAssets'>
) {
	const refs = await ctx.db
		.query('fileReferences')
		.withIndex('by_updateId', (q) => q.eq('updateId', updateId))
		.take(2);
	for (const ref of refs) {
		await ctx.db.delete('fileReferences', ref._id);
		const asset = await ctx.db.get('fileAssets', ref.assetId);
		const object = asset?.objectId ? await ctx.db.get('fileObjects', asset.objectId) : null;
		if (object) await enqueueCleanup(ctx, object);
	}
	// Pending cover candidates cannot attach after their update has gone away.
	const candidates = await ctx.db
		.query('fileAssets')
		.withIndex('by_coverUpdateId', (q) => q.eq('coverUpdateId', updateId))
		.take(100);
	for (const asset of candidates)
		if (asset._id !== keepAssetId && asset.state === 'pending' && asset.objectId) {
			const object = await ctx.db.get('fileObjects', asset.objectId);
			if (object) await enqueueCleanup(ctx, object);
		}
}
