import { v } from 'convex/values';

import { internalMutation, internalQuery } from './_generated/server';

export const seed = internalMutation({
	args: {},
	handler: async (ctx) => {
		if (process.env.CONVEX_SITE_URL !== 'http://127.0.0.1:4431')
			throw new Error('Local cascade proof only');
		const userId = await ctx.db.insert('users', { verified: true });
		const organizationId = await ctx.db.insert('organizations', { ownerId: userId });
		return { userId, organizationId };
	},
});

export const inspect = internalQuery({
	args: { jobId: v.id('branchJobs'), boardId: v.id('boards') },
	handler: async (ctx, args) => {
		if (process.env.CONVEX_SITE_URL !== 'http://127.0.0.1:4431')
			throw new Error('Local cascade proof only');
		const remaining: string[] = [];
		for (const table of [
			'feedback',
			'comments',
			'reactions',
			'votes',
			'events',
			'links',
		] as const) {
			if (
				await ctx.db
					.query(table)
					.withIndex('by_boardId', (q) => q.eq('boardId', args.boardId))
					.first()
			)
				remaining.push(table);
		}
		const job = await ctx.db.get(args.jobId);
		return {
			done: job?.done ?? false,
			processed: job?.processed,
			remaining,
			boardExists: !!(await ctx.db.get(args.boardId)),
		};
	},
});

export const inspectProjectStorage = internalQuery({
	args: { projectId: v.id('projects') },
	handler: async (ctx, args) => {
		if (process.env.CONVEX_SITE_URL !== 'http://127.0.0.1:4431')
			throw new Error('Local cascade proof only');
		const objects = await ctx.db
			.query('fileObjects')
			.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
			.take(100);
		const assets = await ctx.db
			.query('fileAssets')
			.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
			.take(100);
		const cleanupJobs = await ctx.db
			.query('storageCleanupJobs')
			.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
			.take(100);
		const usage = await ctx.db
			.query('projectStorageUsage')
			.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
			.unique();
		return {
			projectExists: !!(await ctx.db.get(args.projectId)),
			objectKeys: objects.map((object) => object.key),
			assetCount: assets.length,
			cleanupStates: cleanupJobs.map((job) => job.state),
			usage: usage
				? {
						usedBytes: usage.usedBytes,
						reservedBytes: usage.reservedBytes,
						fileCount: usage.fileCount,
					}
				: null,
		};
	},
});
