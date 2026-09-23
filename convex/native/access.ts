import type { Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

import { ConvexError } from 'convex/values';

import { getCurrentUser, requireCurrentUser } from './identity';

export async function findMembership(
	ctx: QueryCtx,
	organizationId: Id<'organizations'>,
	userId: Id<'users'>
) {
	return ctx.db
		.query('memberships')
		.withIndex('by_organizationId_and_userId', (q) =>
			q.eq('organizationId', organizationId).eq('userId', userId)
		)
		.unique();
}

export async function requireMembership(ctx: QueryCtx, organizationId: Id<'organizations'>) {
	const user = await requireCurrentUser(ctx);
	const [organization, membership] = await Promise.all([
		ctx.db.get('organizations', organizationId),
		findMembership(ctx, organizationId, user._id),
	]);
	if (!organization || !membership) throw new ConvexError('FORBIDDEN');
	return { membership, organization, user };
}

export async function requireOrganizationManager(
	ctx: QueryCtx,
	organizationId: Id<'organizations'>
) {
	const user = await requireCurrentUser(ctx);
	const organization = await ctx.db.get('organizations', organizationId);
	if (!organization) throw new ConvexError('ORGANIZATION_NOT_FOUND');
	if (user.systemRole === 'system:admin') {
		return { organization, role: 'system:admin' as const, user };
	}
	const membership = await findMembership(ctx, organizationId, user._id);
	if (!membership || membership.role === 'moderator') throw new ConvexError('FORBIDDEN');
	return { organization, role: membership.role, user };
}

export async function resolveOrganizationAccess(
	ctx: QueryCtx,
	organizationId: Id<'organizations'>
) {
	const organization = await ctx.db.get('organizations', organizationId);
	const user = await getCurrentUser(ctx);
	const membership =
		organization && user ? await findMembership(ctx, organizationId, user._id) : null;
	const isManager =
		!!organization &&
		(user?.systemRole === 'system:admin' ||
			membership?.role === 'owner' ||
			membership?.role === 'admin');
	const canView =
		!!organization && (organization.visibility === 'public' || !!membership || isManager);
	const role: 'system:admin' | 'owner' | 'admin' | 'moderator' | null = !canView
		? null
		: user?.systemRole === 'system:admin'
			? 'system:admin'
			: (membership?.role ?? null);
	return {
		organization: canView ? organization : null,
		membership: canView ? membership : null,
		role,
		permissions: {
			canView,
			canCreateProjects: isManager,
			canEdit: isManager,
			canManageMembers: isManager,
			canDelete: isManager,
		},
	};
}

const noProjectPermissions = {
	canView: false,
	canManageContent: false,
	canEditSettings: false,
	canManageAccess: false,
	canManageIntegrations: false,
	canDelete: false,
};

export async function resolveProjectAccess(
	ctx: QueryCtx,
	projectId: Id<'projects'>,
	includeDeleting = false
) {
	const project = await ctx.db.get('projects', projectId);
	const user = await getCurrentUser(ctx);
	const organization = project && (await ctx.db.get('organizations', project.organizationId));
	if (!project || !organization || (project.deletingAt !== undefined && !includeDeleting)) {
		return { project: null, isArchived: false, permissions: { ...noProjectPermissions } };
	}
	const membership = user ? await findMembership(ctx, organization._id, user._id) : null;
	const manager =
		user?.systemRole === 'system:admin' ||
		membership?.role === 'owner' ||
		membership?.role === 'admin';
	const assignment =
		membership?.role === 'moderator'
			? await ctx.db
					.query('projectModeratorAssignments')
					.withIndex('by_membershipId_and_projectId', (q) =>
						q.eq('membershipId', membership._id).eq('projectId', projectId)
					)
					.unique()
			: null;
	const directMember = user
		? await ctx.db
				.query('projectMembers')
				.withIndex('by_projectId_and_userId', (q) =>
					q.eq('projectId', projectId).eq('userId', user._id)
				)
				.unique()
		: null;
	const canView =
		!!manager ||
		!!assignment ||
		(project.visibility === 'public' && (organization.visibility === 'public' || !!membership)) ||
		((project.visibility === 'public' || project.visibility === 'private') && !!directMember);
	return {
		project: canView ? project : null,
		isArchived: canView && project.visibility === 'archived',
		permissions: {
			canView,
			canManageContent: !!manager || !!assignment,
			canEditSettings: !!manager || !!assignment,
			canManageAccess: !!manager,
			canManageIntegrations: !!manager,
			canDelete: !!manager,
		},
	};
}

export async function requireProjectAccess(
	ctx: QueryCtx,
	projectId: Id<'projects'>,
	includeDeleting = false
) {
	await requireCurrentUser(ctx);
	const access = await resolveProjectAccess(ctx, projectId, includeDeleting);
	if (!access.project) throw new ConvexError('FORBIDDEN');
	return { ...access, project: access.project };
}

export function assertProjectWritable(access: { isArchived: boolean }) {
	if (access.isArchived) throw new ConvexError('PROJECT_ARCHIVED');
}
