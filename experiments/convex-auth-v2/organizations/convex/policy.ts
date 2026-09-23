import { ConvexError, v } from 'convex/values';

import { mutation, query } from './_generated/server';
import {
	assertWritable,
	manage,
	organizationAccess,
	projectAccess,
	resolveProjectAccess,
} from './access';

export const viewOrganization = query({
	args: { organizationId: v.id('organizations') },
	handler: (ctx, args) => organizationAccess(ctx, args.organizationId),
});
export const viewProject = query({
	args: { projectId: v.id('projects') },
	handler: (ctx, args) => resolveProjectAccess(ctx, args.projectId),
});
export const setOrganizationVisibility = mutation({
	args: {
		organizationId: v.id('organizations'),
		visibility: v.union(v.literal('public'), v.literal('private')),
	},
	handler: async (ctx, args) => {
		await manage(ctx, args.organizationId);
		await ctx.db.patch(args.organizationId, { visibility: args.visibility });
		return null;
	},
});
export const updateProject = mutation({
	args: {
		projectId: v.id('projects'),
		name: v.optional(v.string()),
		visibility: v.optional(
			v.union(v.literal('public'), v.literal('private'), v.literal('archived'))
		),
	},
	handler: async (ctx, args) => {
		const access = await projectAccess(ctx, args.projectId);
		if (!access.permissions.canEditSettings) throw new ConvexError('FORBIDDEN');
		if (access.isArchived) {
			if (!access.permissions.canManageAccess || !args.visibility || args.visibility === 'archived')
				throw new ConvexError('PROJECT_ARCHIVED');
		} else if (args.visibility === 'archived' && !access.permissions.canManageAccess)
			throw new ConvexError('FORBIDDEN');
		if (args.name !== undefined && (!args.name.trim() || args.name.length > 100))
			throw new ConvexError('INVALID_PROJECT');
		await ctx.db.patch(args.projectId, {
			...(args.name !== undefined ? { name: args.name } : {}),
			...(args.visibility !== undefined ? { visibility: args.visibility } : {}),
		});
		return null;
	},
});
export const setProjectMember = mutation({
	args: { projectId: v.id('projects'), userId: v.id('users'), enabled: v.boolean() },
	handler: async (ctx, args) => {
		const access = await projectAccess(ctx, args.projectId);
		if (!access.permissions.canManageAccess) throw new ConvexError('FORBIDDEN');
		assertWritable(access);
		if (!(await ctx.db.get(args.userId))) throw new ConvexError('USER_NOT_FOUND');
		const row = await ctx.db
			.query('projectMembers')
			.withIndex('by_projectId_userId', (q) =>
				q.eq('projectId', args.projectId).eq('userId', args.userId)
			)
			.unique();
		if (args.enabled && !row)
			await ctx.db.insert('projectMembers', { projectId: args.projectId, userId: args.userId });
		if (!args.enabled && row) await ctx.db.delete(row._id);
		return null;
	},
});
export const removeProject = mutation({
	args: { projectId: v.id('projects') },
	handler: async (ctx, args) => {
		const access = await projectAccess(ctx, args.projectId);
		if (!access.permissions.canDelete) throw new ConvexError('FORBIDDEN');
		// Archived deletion is an explicit exception; oversized cleanup fails atomically.
		const assignments = await ctx.db
			.query('assignments')
			.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
			.take(201);
		const members = await ctx.db
			.query('projectMembers')
			.withIndex('by_projectId_userId', (q) => q.eq('projectId', args.projectId))
			.take(201);
		if (assignments.length > 200 || members.length > 200) throw new ConvexError('CLEANUP_LIMIT');
		for (const row of [...assignments, ...members]) await ctx.db.delete(row._id);
		await ctx.db.delete(args.projectId);
		return null;
	},
});
