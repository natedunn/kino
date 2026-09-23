import type { Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

import { ConvexError, v } from 'convex/values';

import {
	isReservedHandle,
	normalizeSlug as normalizeGeneratedSlug,
	VALIDATION_LIMITS,
} from '../shared/validation';
import { mutation, query } from './_generated/server';
import { requireMembership, requireOrganizationManager, resolveOrganizationAccess } from './access';
import { getCurrentUser, requireCurrentUser } from './identity';
import { assignableOrganizationRole, organizationRole } from './schema';

// Native accounts always own a personal organization, unlike the legacy org
// list. Keep its slot separate from the one free team (or 100 admin teams).
export const MAX_ORGANIZATIONS_PER_USER = 101;
const TEAM_LIMITS = { user: 1, 'system:admin': 100 } as const;
export const MAX_ORGANIZATION_MEMBERS = 200;
export const MAX_PROJECT_ASSIGNMENTS = 200;

export async function validateOrganizationProjects(
	ctx: QueryCtx,
	organizationId: Id<'organizations'>,
	role: 'admin' | 'moderator',
	projectIds: Array<Id<'projects'>>
) {
	if (
		projectIds.length > MAX_PROJECT_ASSIGNMENTS ||
		new Set(projectIds).size !== projectIds.length ||
		(role === 'admin' ? projectIds.length !== 0 : projectIds.length === 0)
	)
		throw new ConvexError('INVALID_ASSIGNMENTS');
	for (const projectId of projectIds) {
		const project = await ctx.db.get('projects', projectId);
		if (!project || project.organizationId !== organizationId || project.deletingAt !== undefined)
			throw new ConvexError('INVALID_ASSIGNMENTS');
	}
}

async function clearAssignments(ctx: MutationCtx, membershipId: Id<'memberships'>) {
	const rows = await ctx.db
		.query('projectModeratorAssignments')
		.withIndex('by_membershipId_and_projectId', (q) => q.eq('membershipId', membershipId))
		.take(MAX_PROJECT_ASSIGNMENTS + 1);
	if (rows.length > MAX_PROJECT_ASSIGNMENTS) throw new ConvexError('ASSIGNMENT_LIMIT');
	for (const row of rows) await ctx.db.delete('projectModeratorAssignments', row._id);
}

function normalizeSlug(value: string) {
	const slug = value.trim().toLowerCase();
	if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug))
		throw new ConvexError('INVALID_ORGANIZATION_SLUG');
	return slug;
}

async function availableOrganizationSlug(ctx: MutationCtx, preferred: string, userId: Id<'users'>) {
	const normalized = normalizeGeneratedSlug(preferred, VALIDATION_LIMITS.orgSlug);
	const suffix = userId.slice(-8).toLowerCase();
	const base = normalized && !isReservedHandle(normalized) ? normalized : `org-${suffix}`;
	for (let attempt = 0; attempt < 10; attempt++) {
		const candidate =
			attempt === 0
				? base
				: normalizeGeneratedSlug(
						`${base.slice(0, VALIDATION_LIMITS.orgSlug - 10)}-${suffix}${attempt}`,
						VALIDATION_LIMITS.orgSlug
					);
		const existing = await ctx.db
			.query('organizations')
			.withIndex('by_slug', (q) => q.eq('slug', candidate))
			.unique();
		if (!existing) return candidate;
	}
	throw new ConvexError('ORGANIZATION_SLUG_UNAVAILABLE');
}

export async function ensurePersonalOrganization(ctx: MutationCtx, userId: Id<'users'>) {
	const user = await ctx.db.get('users', userId);
	if (!user || user.status !== 'active' || !user.profileId)
		throw new ConvexError('ACCOUNT_NOT_READY');
	const profile = await ctx.db.get('profiles', user.profileId);
	if (!profile || profile.userId !== userId) throw new ConvexError('PROFILE_NOT_FOUND');
	const existing = await ctx.db
		.query('organizations')
		.withIndex('by_personalOwnerId', (q) => q.eq('personalOwnerId', userId))
		.unique();
	if (existing) {
		const member = await ctx.db
			.query('memberships')
			.withIndex('by_organizationId_and_userId', (q) =>
				q.eq('organizationId', existing._id).eq('userId', userId)
			)
			.unique();
		// Logging in cannot restore a revoked grant or promote a demoted member.
		if (
			member?.role !== 'owner' ||
			(user.personalOrganizationId && user.personalOrganizationId !== existing._id)
		)
			throw new ConvexError('PERSONAL_ORGANIZATION_CONFLICT');
		if (!user.personalOrganizationId)
			await ctx.db.patch('users', userId, { personalOrganizationId: existing._id });
		return existing._id;
	}
	if (user.personalOrganizationId) throw new ConvexError('PERSONAL_ORGANIZATION_CONFLICT');
	const base = profile.username.slice(0, 30);
	for (let attempt = 0; attempt < 10; attempt++) {
		const slug = attempt === 0 ? base : `${base}-${userId.slice(-8)}${attempt}`;
		if (
			await ctx.db
				.query('organizations')
				.withIndex('by_slug', (q) => q.eq('slug', slug))
				.unique()
		)
			continue;
		const organizationId = await ctx.db.insert('organizations', {
			name: profile.name,
			slug,
			visibility: 'public',
			personalOwnerId: userId,
		});
		await ctx.db.insert('memberships', { organizationId, userId, role: 'owner' });
		await ctx.db.patch('users', userId, { personalOrganizationId: organizationId });
		return organizationId;
	}
	throw new ConvexError('ORGANIZATION_SLUG_UNAVAILABLE');
}

export const personal = query({
	args: {},
	returns: v.union(
		v.null(),
		v.object({
			id: v.id('organizations'),
			name: v.string(),
			slug: v.string(),
			role: v.literal('owner'),
		})
	),
	handler: async (ctx) => {
		const user = await getCurrentUser(ctx);
		if (!user?.personalOrganizationId) return null;
		const organization = await ctx.db.get('organizations', user.personalOrganizationId);
		if (!organization || organization.personalOwnerId !== user._id) return null;
		const membership = await ctx.db
			.query('memberships')
			.withIndex('by_organizationId_and_userId', (q) =>
				q.eq('organizationId', organization._id).eq('userId', user._id)
			)
			.unique();
		if (membership?.role !== 'owner') return null;
		return {
			id: organization._id,
			name: organization.name,
			slug: organization.slug,
			role: 'owner' as const,
		};
	},
});

export const create = mutation({
	args: { name: v.string(), slug: v.string() },
	returns: v.id('organizations'),
	handler: async (ctx, args) => {
		const user = await requireCurrentUser(ctx);
		const name = args.name.trim();
		const slug = normalizeSlug(args.slug);
		if (!name || name.length > 100) throw new ConvexError('INVALID_ORGANIZATION_NAME');
		if (!(await canCreateTeam(ctx, user))) throw new ConvexError('ORGANIZATION_LIMIT_REACHED');
		if (
			await ctx.db
				.query('organizations')
				.withIndex('by_slug', (q) => q.eq('slug', slug))
				.unique()
		)
			throw new ConvexError('ORGANIZATION_SLUG_TAKEN');
		const organizationId = await ctx.db.insert('organizations', {
			name,
			slug,
			visibility: 'public',
		});
		await ctx.db.insert('memberships', { organizationId, userId: user._id, role: 'owner' });
		return organizationId;
	},
});

// Transport-compatible creation surface for the existing `/create/team` form.
// Keep the original `create` mutation stable for the native proof/dashboard.
export const createForRoute = mutation({
	args: {
		name: v.string(),
		slug: v.optional(v.string()),
		visibility: v.union(v.literal('public'), v.literal('private')),
	},
	returns: v.object({ id: v.id('organizations'), slug: v.string() }),
	handler: async (ctx, args) => {
		const user = await requireCurrentUser(ctx);
		const name = args.name.trim();
		if (!name || name.length > 100) throw new ConvexError('INVALID_ORGANIZATION_NAME');
		if (!(await canCreateTeam(ctx, user))) throw new ConvexError('ORGANIZATION_LIMIT_REACHED');
		const slug = await availableOrganizationSlug(ctx, args.slug || name, user._id);
		const id = await ctx.db.insert('organizations', {
			name,
			slug,
			visibility: args.visibility,
		});
		await ctx.db.insert('memberships', { organizationId: id, userId: user._id, role: 'owner' });
		return { id, slug };
	},
});

async function canCreateTeam(
	ctx: QueryCtx,
	user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
) {
	const memberships = await ctx.db
		.query('memberships')
		.withIndex('by_userId', (q) => q.eq('userId', user._id))
		.take(MAX_ORGANIZATIONS_PER_USER + 1);
	const teams = memberships.filter(
		(membership) => membership.organizationId !== user.personalOrganizationId
	);
	return teams.length < TEAM_LIMITS[user.systemRole];
}

const organizationListRow = v.object({
	logo: v.union(v.null(), v.string()),
	id: v.id('organizations'),
	name: v.string(),
	slug: v.string(),
	visibility: v.union(v.literal('public'), v.literal('private')),
	role: organizationRole,
	canManage: v.boolean(),
});

async function listMyOrganizations(
	ctx: QueryCtx,
	user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
) {
	const memberships = await ctx.db
		.query('memberships')
		.withIndex('by_userId', (q) => q.eq('userId', user._id))
		.take(MAX_ORGANIZATIONS_PER_USER + 1);
	if (memberships.length > MAX_ORGANIZATIONS_PER_USER)
		throw new ConvexError('ORGANIZATION_LIMIT_REACHED');
	const rows = await Promise.all(
		memberships.map(async (membership) => {
			const organization = await ctx.db.get('organizations', membership.organizationId);
			return organization
				? {
						id: organization._id,
						logo: organization.logoStorageId
							? await ctx.storage.getUrl(organization.logoStorageId)
							: null,
						name: organization.name,
						slug: organization.slug,
						visibility: organization.visibility,
						role: membership.role,
						canManage: membership.role === 'owner' || membership.role === 'admin',
					}
				: null;
		})
	);
	return rows.filter((row) => row !== null).sort((a, b) => a.name.localeCompare(b.name));
}

export const listMine = query({
	args: {},
	returns: v.array(organizationListRow),
	handler: async (ctx) => {
		const user = await getCurrentUser(ctx);
		return user ? listMyOrganizations(ctx, user) : [];
	},
});

export const listMineForRoute = query({
	args: {},
	returns: v.object({ teams: v.array(organizationListRow), underLimit: v.boolean() }),
	handler: async (ctx) => {
		const user = await requireCurrentUser(ctx);
		const [teams, underLimit] = await Promise.all([
			listMyOrganizations(ctx, user),
			canCreateTeam(ctx, user),
		]);
		return { teams, underLimit };
	},
});

export const getBySlug = query({
	args: { slug: v.string() },
	returns: v.union(
		v.null(),
		v.object({
			logo: v.union(v.null(), v.string()),
			id: v.id('organizations'),
			name: v.string(),
			slug: v.string(),
			visibility: v.union(v.literal('public'), v.literal('private')),
			role: v.union(v.null(), organizationRole, v.literal('system:admin')),
			permissions: v.object({
				canView: v.boolean(),
				canCreateProjects: v.boolean(),
				canEdit: v.boolean(),
				canManageMembers: v.boolean(),
				canDelete: v.boolean(),
			}),
		})
	),
	handler: async (ctx, { slug }) => {
		const organization = await ctx.db
			.query('organizations')
			.withIndex('by_slug', (q) => q.eq('slug', slug))
			.unique();
		if (!organization) return null;
		const access = await resolveOrganizationAccess(ctx, organization._id);
		if (!access.organization) return null;
		return {
			id: organization._id,
			logo: organization.logoStorageId
				? await ctx.storage.getUrl(organization.logoStorageId)
				: null,
			name: organization.name,
			slug: organization.slug,
			visibility: organization.visibility,
			role: access.role,
			permissions: access.permissions,
		};
	},
});

export const listMembers = query({
	args: { organizationId: v.id('organizations') },
	returns: v.object({
		canManage: v.boolean(),
		currentUserRole: v.union(organizationRole, v.literal('system:admin')),
		members: v.array(
			v.object({
				id: v.id('memberships'),
				role: organizationRole,
				assignedProjectCount: v.number(),
				user: v.object({
					id: v.id('users'),
					email: v.string(),
					name: v.string(),
					username: v.string(),
					image: v.union(v.null(), v.string()),
				}),
			})
		),
	}),
	handler: async (ctx, { organizationId }) => {
		const manager = await requireOrganizationManager(ctx, organizationId);
		const memberships = await ctx.db
			.query('memberships')
			.withIndex('by_organizationId_and_role', (q) => q.eq('organizationId', organizationId))
			.take(MAX_ORGANIZATION_MEMBERS + 1);
		if (memberships.length > MAX_ORGANIZATION_MEMBERS)
			throw new ConvexError('MEMBERSHIP_LIMIT_REACHED');
		const members = await Promise.all(
			memberships.map(async (membership) => {
				const [user, assignments] = await Promise.all([
					ctx.db.get('users', membership.userId),
					membership.role === 'moderator'
						? ctx.db
								.query('projectModeratorAssignments')
								.withIndex('by_membershipId_and_projectId', (q) =>
									q.eq('membershipId', membership._id)
								)
								.take(MAX_PROJECT_ASSIGNMENTS + 1)
						: Promise.resolve([]),
				]);
				const profile = user?.profileId ? await ctx.db.get('profiles', user.profileId) : null;
				if (!user || !profile) return null;
				return {
					id: membership._id,
					role: membership.role,
					assignedProjectCount: assignments.length,
					user: {
						id: user._id,
						email: user.passwordEmail ?? user.githubEmail ?? '',
						name: profile.name,
						username: profile.username,
						image: profile.imageUrl ?? null,
					},
				};
			})
		);
		return {
			canManage: true,
			currentUserRole: manager.role,
			members: members.filter((member) => member !== null),
		};
	},
});

export const setMemberRole = mutation({
	args: {
		membershipId: v.id('memberships'),
		role: assignableOrganizationRole,
		projectIds: v.array(v.id('projects')),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const membership = await ctx.db.get('memberships', args.membershipId);
		if (!membership) throw new ConvexError('MEMBERSHIP_NOT_FOUND');
		await requireOrganizationManager(ctx, membership.organizationId);
		if (membership.role === 'owner') throw new ConvexError('OWNER_FROZEN');
		await validateOrganizationProjects(ctx, membership.organizationId, args.role, args.projectIds);
		await clearAssignments(ctx, membership._id);
		await ctx.db.patch('memberships', membership._id, { role: args.role });
		for (const projectId of args.projectIds) {
			await ctx.db.insert('projectModeratorAssignments', {
				membershipId: membership._id,
				projectId,
			});
		}
		return null;
	},
});

export const removeMember = mutation({
	args: { membershipId: v.id('memberships') },
	returns: v.null(),
	handler: async (ctx, { membershipId }) => {
		const membership = await ctx.db.get('memberships', membershipId);
		if (!membership) throw new ConvexError('MEMBERSHIP_NOT_FOUND');
		await requireOrganizationManager(ctx, membership.organizationId);
		if (membership.role === 'owner') throw new ConvexError('OWNER_FROZEN');
		await clearAssignments(ctx, membership._id);
		await ctx.db.delete('memberships', membership._id);
		return null;
	},
});

export const leave = mutation({
	args: { organizationId: v.id('organizations') },
	returns: v.null(),
	handler: async (ctx, { organizationId }) => {
		const { membership } = await requireMembership(ctx, organizationId);
		if (membership.role === 'owner') {
			const owners = await ctx.db
				.query('memberships')
				.withIndex('by_organizationId_and_role', (q) =>
					q.eq('organizationId', organizationId).eq('role', 'owner')
				)
				.take(2);
			if (owners.length < 2) throw new ConvexError('LAST_OWNER');
		}
		await clearAssignments(ctx, membership._id);
		await ctx.db.delete('memberships', membership._id);
		return null;
	},
});
