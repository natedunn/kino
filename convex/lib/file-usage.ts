import type { Doc, Id } from '../functions/_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../functions/generated/server';
import type { FileCategory, FileOriginFeature, FileUploaderClass } from '../shared/files';

import { CRPCError } from 'kitcn/server';

import { projectStorageUsageTable } from '../functions/schema';
import { getProjectStorageLimitBytes } from '../shared/files';

type UsageCtx = Pick<QueryCtx, 'db'> | Pick<MutationCtx, 'db' | 'orm'>;
type BreakdownValue = { bytes: number; files: number };
export type UsageBreakdown = Record<string, BreakdownValue>;

export async function getProjectStorageUsage(ctx: UsageCtx, projectId: Id<'project'>) {
	return await ctx.db
		.query('projectStorageUsage')
		.withIndex('by_projectId', (query) => query.eq('projectId', projectId))
		.unique();
}

export async function reserveProjectStorage(
	ctx: Pick<MutationCtx, 'db' | 'orm'>,
	args: { bytes: number; orgSlug: string; projectId: Id<'project'> }
) {
	const current = await getProjectStorageUsage(ctx, args.projectId);
	const usedBytes = current?.usedBytes ?? 0;
	const reservedBytes = current?.reservedBytes ?? 0;
	const limitBytes = getProjectStorageLimitBytes();
	if (usedBytes + reservedBytes + args.bytes > limitBytes) {
		throw new CRPCError({
			code: 'BAD_REQUEST',
			message: 'This upload would exceed the project storage limit',
			data: { availableBytes: Math.max(0, limitBytes - usedBytes - reservedBytes), limitBytes },
		});
	}

	if (current) {
		await ctx.db.patch('projectStorageUsage', current._id, {
			reservedBytes: reservedBytes + args.bytes,
			updatedTime: Date.now(),
		});
		return;
	}

	await ctx.orm.insert(projectStorageUsageTable).values({
		byCategory: {},
		byOrigin: {},
		byUploaderClass: {},
		fileCount: 0,
		orgSlug: args.orgSlug,
		projectId: args.projectId,
		reservedBytes: args.bytes,
		updatedTime: Date.now(),
		usedBytes: 0,
	});
}

export async function rejectReservedFile(ctx: Pick<MutationCtx, 'db'>, object: Doc<'fileObject'>) {
	if (object.status !== 'pending') return;
	const usage = await getProjectStorageUsage(ctx, object.projectId);
	if (!usage) return;
	await ctx.db.patch('projectStorageUsage', usage._id, {
		reservedBytes: Math.max(0, usage.reservedBytes - object.declaredBytes),
		updatedTime: Date.now(),
	});
}

export async function commitReadyFile(
	ctx: Pick<MutationCtx, 'db'>,
	args: {
		actualBytes: number;
		category: FileCategory;
		object: Doc<'fileObject'>;
		originFeature: FileOriginFeature;
		uploaderClass: FileUploaderClass;
	}
) {
	const usage = await getProjectStorageUsage(ctx, args.object.projectId);
	if (!usage) {
		throw new CRPCError({
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Storage reservation is missing',
		});
	}
	const nextReserved = Math.max(0, usage.reservedBytes - args.object.declaredBytes);
	const nextUsed = usage.usedBytes + args.actualBytes;
	if (nextUsed + nextReserved > getProjectStorageLimitBytes()) {
		throw new CRPCError({
			code: 'BAD_REQUEST',
			message: 'The uploaded file exceeds the remaining project storage',
		});
	}

	await ctx.db.patch('projectStorageUsage', usage._id, {
		byCategory: addBreakdown(
			usage.byCategory as UsageBreakdown,
			args.category,
			args.actualBytes,
			1
		),
		byOrigin: addBreakdown(
			usage.byOrigin as UsageBreakdown,
			args.originFeature,
			args.actualBytes,
			1
		),
		byUploaderClass: addBreakdown(
			usage.byUploaderClass as UsageBreakdown,
			args.uploaderClass,
			args.actualBytes,
			1
		),
		fileCount: usage.fileCount + 1,
		reservedBytes: nextReserved,
		updatedTime: Date.now(),
		usedBytes: nextUsed,
	});
}

export async function releaseReadyFile(
	ctx: Pick<MutationCtx, 'db'>,
	args: {
		asset: Pick<Doc<'fileAsset'>, 'category' | 'originFeature' | 'uploaderClass'>;
		object: Doc<'fileObject'>;
	}
) {
	if (args.object.status !== 'ready') return;
	const usage = await getProjectStorageUsage(ctx, args.object.projectId);
	if (!usage) return;
	const bytes = args.object.actualBytes ?? 0;
	await ctx.db.patch('projectStorageUsage', usage._id, {
		byCategory: addBreakdown(usage.byCategory as UsageBreakdown, args.asset.category, -bytes, -1),
		byOrigin: addBreakdown(usage.byOrigin as UsageBreakdown, args.asset.originFeature, -bytes, -1),
		byUploaderClass: addBreakdown(
			usage.byUploaderClass as UsageBreakdown,
			args.asset.uploaderClass,
			-bytes,
			-1
		),
		fileCount: Math.max(0, usage.fileCount - 1),
		updatedTime: Date.now(),
		usedBytes: Math.max(0, usage.usedBytes - bytes),
	});
}

function addBreakdown(
	breakdown: UsageBreakdown,
	key: string,
	byteDelta: number,
	fileDelta: number
): UsageBreakdown {
	const current = breakdown[key] ?? { bytes: 0, files: 0 };
	const next = {
		...breakdown,
		[key]: {
			bytes: Math.max(0, current.bytes + byteDelta),
			files: Math.max(0, current.files + fileDelta),
		},
	};
	if (next[key].bytes === 0 && next[key].files === 0) delete next[key];
	return next;
}
