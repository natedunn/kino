import type { Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

import { ConvexError, v } from 'convex/values';

import { mutation, query } from './_generated/server';
import {
	assertProjectWritable,
	requireOrganizationManager,
	requireProjectAccess,
	resolveOrganizationAccess,
	resolveProjectAccess,
} from './access';
import { requireCurrentUser } from './identity';
import { projectVisibility } from './schema';

const PROJECT_LIMITS = { user: 1, 'system:admin': 100 } as const;

async function canAddProject(
	ctx: QueryCtx,
	organizationId: Id<'organizations'>,
	systemRole: keyof typeof PROJECT_LIMITS
) {
	const limit = PROJECT_LIMITS[systemRole];
	const projects = await ctx.db
		.query('projects')
		.withIndex('by_organizationId', (q) => q.eq('organizationId', organizationId))
		.take(limit);
	return projects.length < limit;
}

export const getMyProjectCreationPermission = query({
	args: { orgSlug: v.string() },
	returns: v.object({ canAddProjects: v.boolean() }),
	handler: async (ctx, { orgSlug }) => {
		const user = await requireCurrentUser(ctx);
		const organization = await ctx.db
			.query('organizations')
			.withIndex('by_slug', (q) => q.eq('slug', orgSlug))
			.unique();
		if (!organization) return { canAddProjects: false };
		const access = await resolveOrganizationAccess(ctx, organization._id);
		if (!access.permissions.canCreateProjects) return { canAddProjects: false };
		return {
			canAddProjects: await canAddProject(ctx, organization._id, user.systemRole),
		};
	},
});

async function insertProject(
	ctx: MutationCtx,
	args: {
		organizationId: Id<'organizations'>;
		name: string;
		slug: string;
		visibility: 'public' | 'private';
	}
) {
	const { user, organization } = await requireOrganizationManager(ctx, args.organizationId);
	if (args.visibility === 'public' && organization.visibility === 'private')
		throw new ConvexError('PROJECT_PUBLIC_REQUIRES_PUBLIC_ORGANIZATION');
	if (!(await canAddProject(ctx, args.organizationId, user.systemRole)))
		throw new ConvexError('PROJECT_LIMIT_REACHED');
	const name = args.name.trim();
	const slug = args.slug.trim().toLowerCase();
	if (!name || name.length > 100 || !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug))
		throw new ConvexError('INVALID_PROJECT');
	if (
		await ctx.db
			.query('projects')
			.withIndex('by_organizationId_and_slug', (q) =>
				q.eq('organizationId', args.organizationId).eq('slug', slug)
			)
			.unique()
	)
		throw new ConvexError('PROJECT_SLUG_TAKEN');
	const projectId = await ctx.db.insert('projects', {
		organizationId: args.organizationId,
		name,
		slug,
		visibility: args.visibility,
	});
	for (const board of [
		{ icon: 'bug', name: 'Bugs', slug: 'bugs' },
		{ icon: 'lightbulb', name: 'Feature Requests', slug: 'feature-requests' },
		{ icon: 'improvements', name: 'Improvements', slug: 'improvements' },
	]) {
		await ctx.db.insert('feedbackBoards', { projectId, ...board });
	}
	return { id: projectId, slug };
}

export const viewOrganization = query({
	args: { organizationId: v.id('organizations') },
	handler: (ctx, { organizationId }) => resolveOrganizationAccess(ctx, organizationId),
});

export const viewProject = query({
	args: { projectId: v.id('projects') },
	handler: (ctx, { projectId }) => resolveProjectAccess(ctx, projectId),
});

export const createProject = mutation({
	args: { organizationId: v.id('organizations'), name: v.string(), slug: v.string() },
	returns: v.id('projects'),
	handler: async (ctx, args) => {
		const project = await insertProject(ctx, { ...args, visibility: 'private' });
		return project.id;
	},
});

// Transport-compatible creation surface for the existing full project form.
export const createProjectForRoute = mutation({
	args: {
		name: v.string(),
		orgSlug: v.string(),
		slug: v.string(),
		visibility: v.union(v.literal('public'), v.literal('private')),
	},
	returns: v.object({ id: v.id('projects'), slug: v.string() }),
	handler: async (ctx, args) => {
		const organization = await ctx.db
			.query('organizations')
			.withIndex('by_slug', (q) => q.eq('slug', args.orgSlug))
			.unique();
		if (!organization) throw new ConvexError('ORGANIZATION_NOT_FOUND');
		return insertProject(ctx, { ...args, organizationId: organization._id });
	},
});

export const updateProject = mutation({
	args: {
		projectId: v.id('projects'),
		name: v.optional(v.string()),
		visibility: v.optional(projectVisibility),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const access = await requireProjectAccess(ctx, args.projectId);
		if (!access.permissions.canEditSettings) throw new ConvexError('FORBIDDEN');
		if (args.visibility === 'public') {
			const organization = await ctx.db.get('organizations', access.project.organizationId);
			if (organization?.visibility === 'private')
				throw new ConvexError('PROJECT_PUBLIC_REQUIRES_PUBLIC_ORGANIZATION');
		}
		if (access.isArchived) {
			if (!access.permissions.canManageAccess || !args.visibility || args.visibility === 'archived')
				throw new ConvexError('PROJECT_ARCHIVED');
		} else if (args.visibility === 'archived' && !access.permissions.canManageAccess) {
			throw new ConvexError('FORBIDDEN');
		}
		const name = args.name?.trim();
		if (args.name !== undefined && (!name || name.length > 100))
			throw new ConvexError('INVALID_PROJECT');
		await ctx.db.patch('projects', args.projectId, {
			...(name !== undefined ? { name } : {}),
			...(args.visibility !== undefined ? { visibility: args.visibility } : {}),
		});
		return null;
	},
});

export const assertContentWrite = mutation({
	args: { projectId: v.id('projects') },
	returns: v.null(),
	handler: async (ctx, { projectId }) => {
		const access = await requireProjectAccess(ctx, projectId);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		assertProjectWritable(access);
		return null;
	},
});

export const setDirectProjectMember = mutation({
	args: { projectId: v.id('projects'), userId: v.id('users'), enabled: v.boolean() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const access = await requireProjectAccess(ctx, args.projectId);
		if (!access.permissions.canManageAccess) throw new ConvexError('FORBIDDEN');
		assertProjectWritable(access);
		if ((await ctx.db.get('users', args.userId))?.status !== 'active')
			throw new ConvexError('USER_NOT_FOUND');
		const current = await ctx.db
			.query('projectMembers')
			.withIndex('by_projectId_and_userId', (q) =>
				q.eq('projectId', args.projectId).eq('userId', args.userId)
			)
			.unique();
		if (args.enabled && !current)
			await ctx.db.insert('projectMembers', { projectId: args.projectId, userId: args.userId });
		if (!args.enabled && current) await ctx.db.delete('projectMembers', current._id);
		return null;
	},
});

export const setOrganizationVisibility = mutation({
	args: {
		organizationId: v.id('organizations'),
		visibility: v.union(v.literal('public'), v.literal('private')),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireOrganizationManager(ctx, args.organizationId);
		if (args.visibility === 'private') {
			const projects = await ctx.db
				.query('projects')
				.withIndex('by_organizationId', (q) => q.eq('organizationId', args.organizationId))
				.take(101);
			if (projects.length > 100) throw new ConvexError('PROJECT_LIMIT_REACHED');
			for (const project of projects) {
				if (project.visibility === 'public')
					await ctx.db.patch('projects', project._id, { visibility: 'private' });
			}
		}
		await ctx.db.patch('organizations', args.organizationId, { visibility: args.visibility });
		return null;
	},
});
