import type { Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

import { ConvexError } from 'convex/values';

export async function optionalIdentity(ctx: QueryCtx) {
	const auth = await ctx.auth.getUserIdentity();
	const id = auth && ctx.db.normalizeId('users', auth.subject);
	const user = id && (await ctx.db.get(id));
	return user?.verified ? user : null;
}
export async function identity(ctx: QueryCtx) {
	const user = await optionalIdentity(ctx);
	if (!user) throw new ConvexError('UNAUTHORIZED');
	return user;
}
async function findMember(ctx: QueryCtx, organizationId: Id<'organizations'>, userId: Id<'users'>) {
	return ctx.db
		.query('memberships')
		.withIndex('by_organizationId_userId', (q) =>
			q.eq('organizationId', organizationId).eq('userId', userId)
		)
		.unique();
}
export async function membership(ctx: QueryCtx, organizationId: Id<'organizations'>) {
	const user = await identity(ctx);
	const member = await findMember(ctx, organizationId, user._id);
	if (!member || !(await ctx.db.get(organizationId))) throw new ConvexError('FORBIDDEN');
	return member;
}
export async function manage(ctx: QueryCtx, organizationId: Id<'organizations'>) {
	const user = await identity(ctx);
	if (user.systemRole === 'system:admin' && (await ctx.db.get(organizationId)))
		return { userId: user._id, role: 'system:admin' as const };
	const member = await membership(ctx, organizationId);
	if (member.role === 'moderator') throw new ConvexError('FORBIDDEN');
	return member;
}
export async function organizationAccess(ctx: QueryCtx, organizationId: Id<'organizations'>) {
	const organization = await ctx.db.get(organizationId);
	const user = await optionalIdentity(ctx);
	const member = organization && user ? await findMember(ctx, organizationId, user._id) : null;
	const isManager =
		!!organization &&
		(user?.systemRole === 'system:admin' || member?.role === 'owner' || member?.role === 'admin');
	const canView = !!organization && (organization.visibility === 'public' || !!member || isManager);
	return {
		organization: canView ? organization : null,
		role: canView ? (user?.systemRole ?? member?.role ?? null) : null,
		permissions: { canView, canCreate: isManager, canEdit: isManager, canDelete: isManager },
	};
}
const none = {
	canView: false,
	canManageContent: false,
	canEditSettings: false,
	canManageAccess: false,
	canManageIntegrations: false,
	canDelete: false,
};
export async function resolveProjectAccess(ctx: QueryCtx, projectId: Id<'projects'>) {
	const project = await ctx.db.get(projectId);
	const user = await optionalIdentity(ctx);
	const organization = project && (await ctx.db.get(project.organizationId));
	if (!project || !organization)
		return { project: null, permissions: { ...none }, isArchived: false };
	const member = user && (await findMember(ctx, organization._id, user._id));
	const manager =
		user?.systemRole === 'system:admin' || member?.role === 'owner' || member?.role === 'admin';
	const assignment =
		member?.role === 'moderator' &&
		(await ctx.db
			.query('assignments')
			.withIndex('by_membershipId_projectId', (q) =>
				q.eq('membershipId', member._id).eq('projectId', projectId)
			)
			.unique());
	const direct =
		user &&
		(await ctx.db
			.query('projectMembers')
			.withIndex('by_projectId_userId', (q) => q.eq('projectId', projectId).eq('userId', user._id))
			.unique());
	const visibility = project.visibility ?? 'private';
	const canView =
		manager || !!assignment || visibility === 'public' || (visibility === 'private' && !!direct);
	return {
		project: canView ? project : null,
		isArchived: canView && visibility === 'archived',
		permissions: {
			canView,
			canManageContent: manager || !!assignment,
			canEditSettings: manager || !!assignment,
			canManageAccess: manager,
			canManageIntegrations: manager,
			canDelete: manager,
		},
	};
}
export async function projectAccess(ctx: QueryCtx, projectId: Id<'projects'>) {
	await identity(ctx);
	const access = await resolveProjectAccess(ctx, projectId);
	if (!access.project) throw new ConvexError('FORBIDDEN');
	return { ...access, project: access.project };
}
export function assertWritable(access: { isArchived: boolean }) {
	if (access.isArchived) throw new ConvexError('PROJECT_ARCHIVED');
}
