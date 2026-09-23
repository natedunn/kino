import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation } from './_generated/server';
import { enqueueCleanup, usageFor } from './files.lib';

// Called by the authorized project-deletion lifecycle, never directly by a
// browser. That lifecycle must retain the project until this barrier is done.
export const begin = internalMutation({
	args: { projectId: v.id('projects') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const project = await ctx.db.get('projects', args.projectId);
		if (!project) return null;
		if (
			!(await ctx.db
				.query('storageProjectPurges')
				.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
				.unique())
		) {
			await ctx.db.insert('storageProjectPurges', { projectId: args.projectId, done: false });
			await ctx.db.patch('projects', project._id, { storageDeletingAt: Date.now() });
		}
		await ctx.scheduler.runAfter(0, internal.filesProjectPurge.batch, args);
		return null;
	},
});
export const batch = internalMutation({
	args: { projectId: v.id('projects') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const job = await ctx.db
			.query('storageProjectPurges')
			.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
			.unique();
		if (!job || job.done) return null;
		for (const state of ['ready', 'pending'] as const) {
			const assets = await ctx.db
				.query('fileAssets')
				.withIndex('by_projectId_and_state_and_folderId', (q) =>
					q.eq('projectId', args.projectId).eq('state', state)
				)
				.take(25);
			for (const asset of assets) {
				const refs = await ctx.db
					.query('fileReferences')
					.withIndex('by_assetId', (q) => q.eq('assetId', asset._id))
					.take(2);
				for (const ref of refs) {
					const update = await ctx.db.get('updates', ref.updateId);
					if (update?.coverAssetId === asset._id)
						await ctx.db.patch('updates', update._id, { coverAssetId: undefined });
					await ctx.db.delete('fileReferences', ref._id);
				}
				const object = asset.objectId ? await ctx.db.get('fileObjects', asset.objectId) : null;
				if (!object) throw new Error('STORAGE_OBJECT_MISSING');
				await enqueueCleanup(ctx, object);
			}
			if (assets.length === 25) {
				await ctx.scheduler.runAfter(0, internal.filesProjectPurge.batch, args);
				return null;
			}
		}
		if (
			await ctx.db
				.query('fileAssets')
				.withIndex('by_projectId_and_state_and_folderId', (q) =>
					q.eq('projectId', args.projectId).eq('state', 'deleting')
				)
				.first()
		)
			return null;
		const folders = await ctx.db
			.query('fileFolders')
			.withIndex('by_projectId_and_systemKey', (q) => q.eq('projectId', args.projectId))
			.take(50);
		for (const folder of folders) await ctx.db.delete('fileFolders', folder._id);
		if (folders.length === 50) {
			await ctx.scheduler.runAfter(0, internal.filesProjectPurge.batch, args);
			return null;
		}
		const usage = await usageFor(ctx, args.projectId);
		if (usage && (usage.usedBytes !== 0 || usage.reservedBytes !== 0 || usage.fileCount !== 0))
			throw new Error('STORAGE_PURGE_ACCOUNTING_MISMATCH');
		await ctx.db.patch('storageProjectPurges', job._id, { done: true });
		await ctx.scheduler.runAfter(0, internal.projectDeletion.batch, args);
		return null;
	},
});
