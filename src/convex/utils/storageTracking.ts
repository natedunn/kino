import { GenericMutationCtx } from 'convex/server';

import { DataModel } from '../_generated/dataModel';

/**
 * Update storage usage for an org when a file is uploaded/replaced/deleted.
 *
 * @param ctx - The mutation context
 * @param orgSlug - The org's slug
 * @param byteDelta - Positive for uploads, negative for deletes
 * @param fileCountDelta - +1 for new file, -1 for delete, 0 for replace
 */
export async function updateOrgStorageUsage(
	ctx: GenericMutationCtx<DataModel>,
	orgSlug: string,
	byteDelta: number,
	fileCountDelta: number
) {
	const existing = await ctx.db
		.query('orgStorageUsage')
		.withIndex('by_orgSlug', (q) => q.eq('orgSlug', orgSlug))
		.unique();

	if (existing) {
		await ctx.db.patch(existing._id, {
			totalBytes: Math.max(0, existing.totalBytes + byteDelta),
			fileCount: Math.max(0, existing.fileCount + fileCountDelta),
			updatedTime: Date.now(),
		});
	} else {
		await ctx.db.insert('orgStorageUsage', {
			orgSlug,
			totalBytes: Math.max(0, byteDelta),
			fileCount: Math.max(0, fileCountDelta),
			updatedTime: Date.now(),
		});
	}
}

/**
 * Get storage usage for an org.
 */
export async function getOrgStorageUsage(
	ctx: GenericMutationCtx<DataModel>,
	orgSlug: string
) {
	const usage = await ctx.db
		.query('orgStorageUsage')
		.withIndex('by_orgSlug', (q) => q.eq('orgSlug', orgSlug))
		.unique();

	return usage ?? { totalBytes: 0, fileCount: 0 };
}
