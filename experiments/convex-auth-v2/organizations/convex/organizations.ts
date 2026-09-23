import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { mutation, query } from './_generated/server';
import {
	assertWritable,
	identity,
	manage,
	membership,
	organizationAccess,
	projectAccess,
} from './access';
import { assignableRole } from './schema';

// Explicit proof limit makes assignment replacement atomic without silent truncation.
const MAX_ASSIGNMENTS = 50;
export async function validateProjects(
	ctx: MutationCtx,
	organizationId: Id<'organizations'>,
	role: 'admin' | 'moderator',
	projectIds: Id<'projects'>[]
) {
	if (
		projectIds.length > MAX_ASSIGNMENTS ||
		new Set(projectIds).size !== projectIds.length ||
		(role === 'admin' ? projectIds.length !== 0 : projectIds.length === 0)
	)
		throw new ConvexError('INVALID_ASSIGNMENTS');
	for (const id of projectIds) {
		if ((await ctx.db.get(id))?.organizationId !== organizationId)
			throw new ConvexError('INVALID_ASSIGNMENTS');
	}
}
async function clearAssignments(ctx: MutationCtx, membershipId: Id<'memberships'>) {
	const rows = await ctx.db
		.query('assignments')
		.withIndex('by_membershipId_projectId', (q) => q.eq('membershipId', membershipId))
		.take(MAX_ASSIGNMENTS + 1);
	if (rows.length > MAX_ASSIGNMENTS) throw new ConvexError('ASSIGNMENT_LIMIT');
	for (const row of rows) await ctx.db.delete(row._id);
}
export const create = mutation({
	args: { name: v.string(), slug: v.string() },
	handler: async (ctx, args) => {
		const user = await identity(ctx);
		if (!/^[a-z0-9-]{1,64}$/.test(args.slug) || !args.name.trim() || args.name.length > 100)
			throw new ConvexError('INVALID_ORGANIZATION');
		if (
			await ctx.db
				.query('organizations')
				.withIndex('by_slug', (q) => q.eq('slug', args.slug))
				.unique()
		)
			throw new ConvexError('SLUG_TAKEN');
		const id = await ctx.db.insert('organizations', args);
		await ctx.db.insert('memberships', { organizationId: id, userId: user._id, role: 'owner' });
		return id;
	},
});
export const listMine = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: async (ctx, args) => {
		const user = await identity(ctx);
		const result = await ctx.db
			.query('memberships')
			.withIndex('by_userId', (q) => q.eq('userId', user._id))
			.paginate(args.paginationOpts);
		return {
			...result,
			page: await Promise.all(
				result.page.map(async (member) => ({
					organization: await ctx.db.get(member.organizationId),
					role: member.role,
				}))
			),
		};
	},
});
export const get = query({
	args: { organizationId: v.id('organizations') },
	handler: async (ctx, args) => {
		await identity(ctx);
		const access = await organizationAccess(ctx, args.organizationId);
		if (!access.organization) throw new ConvexError('FORBIDDEN');
		return {
			organization: access.organization,
			role: access.role,
			canManage: access.permissions.canEdit,
		};
	},
});
export const createProject = mutation({
	args: { organizationId: v.id('organizations'), name: v.string() },
	handler: async (ctx, args) => {
		await manage(ctx, args.organizationId);
		if (!args.name.trim() || args.name.length > 100) throw new ConvexError('INVALID_PROJECT');
		return ctx.db.insert('projects', { ...args, value: 0 });
	},
});
export const setRole = mutation({
	args: {
		membershipId: v.id('memberships'),
		role: assignableRole,
		projectIds: v.array(v.id('projects')),
	},
	handler: async (ctx, args) => {
		const member = await ctx.db.get(args.membershipId);
		if (!member) throw new ConvexError('FORBIDDEN');
		await manage(ctx, member.organizationId);
		if (member.role === 'owner') throw new ConvexError('OWNER_FROZEN');
		await validateProjects(ctx, member.organizationId, args.role, args.projectIds);
		await clearAssignments(ctx, member._id);
		await ctx.db.patch(member._id, { role: args.role });
		for (const projectId of args.projectIds)
			await ctx.db.insert('assignments', { membershipId: member._id, projectId });
		return null;
	},
});
export const remove = mutation({
	args: { membershipId: v.id('memberships') },
	handler: async (ctx, args) => {
		const member = await ctx.db.get(args.membershipId);
		if (!member) throw new ConvexError('FORBIDDEN');
		await manage(ctx, member.organizationId);
		if (member.role === 'owner') throw new ConvexError('OWNER_FROZEN');
		await clearAssignments(ctx, member._id);
		await ctx.db.delete(member._id);
		return null;
	},
});
export const leave = mutation({
	args: { organizationId: v.id('organizations') },
	handler: async (ctx, args) => {
		const member = await membership(ctx, args.organizationId);
		if (member.role === 'owner') {
			const owners = await ctx.db
				.query('memberships')
				.withIndex('by_organizationId_role', (q) =>
					q.eq('organizationId', args.organizationId).eq('role', 'owner')
				)
				.take(2);
			if (owners.length < 2) throw new ConvexError('LAST_OWNER');
		}
		await clearAssignments(ctx, member._id);
		await ctx.db.delete(member._id);
		return null;
	},
});
export const readProject = query({
	args: { projectId: v.id('projects') },
	handler: async (ctx, args) => {
		const { project, permissions, isArchived } = await projectAccess(ctx, args.projectId);
		return { project, ...permissions, isArchived };
	},
});
export const increment = mutation({
	args: { projectId: v.id('projects') },
	handler: async (ctx, args) => {
		const access = await projectAccess(ctx, args.projectId);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		assertWritable(access);
		const { project } = access;
		await ctx.db.patch(project._id, { value: project.value + 1 });
		return null;
	},
});
