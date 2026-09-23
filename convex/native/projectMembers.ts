import type { Infer } from 'convex/values';
import type { Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

import { ConvexError, v } from 'convex/values';

import { emailSchema } from '../shared/validation';
import { mutation, query } from './_generated/server';
import { assertProjectWritable, requireProjectAccess } from './access';
import { MAX_PROJECT_ASSIGNMENTS } from './organizations';

const profileView = v.object({
	id: v.id('profiles'),
	username: v.string(),
	name: v.union(v.string(), v.null()),
	imageUrl: v.union(v.string(), v.null()),
});
async function manager(ctx: QueryCtx, projectId: Id<'projects'>) {
	const access = await requireProjectAccess(ctx, projectId);
	if (!access.permissions.canManageAccess) throw new ConvexError('FORBIDDEN');
	return access;
}
async function profile(
	ctx: QueryCtx,
	userId: Id<'users'>
): Promise<Infer<typeof profileView> | null> {
	const row = await ctx.db
		.query('profiles')
		.withIndex('by_userId', (q) => q.eq('userId', userId))
		.unique();
	return row
		? { id: row._id, name: row.name, username: row.username, imageUrl: row.imageUrl ?? null }
		: null;
}

export const listProjectMembers = query({
	args: { projectId: v.id('projects') },
	returns: v.object({
		canManage: v.boolean(),
		isPrivate: v.boolean(),
		members: v.array(
			v.object({ id: v.id('projectMembers'), profileId: v.id('profiles'), profile: profileView })
		),
	}),
	handler: async (ctx, { projectId }) => {
		const access = await manager(ctx, projectId);
		const rows = await ctx.db
			.query('projectMembers')
			.withIndex('by_projectId_and_userId', (q) => q.eq('projectId', projectId))
			.take(201);
		if (rows.length > 200) throw new ConvexError('LIMIT_EXCEEDED');
		const members = await Promise.all(
			rows.map(async (row) => {
				const view = await profile(ctx, row.userId);
				return view ? { id: row._id, profileId: view.id, profile: view } : null;
			})
		);
		return {
			canManage: true,
			isPrivate: access.project.visibility === 'private',
			members: members.filter((row) => row !== null),
		};
	},
});

export const getManagementState = query({
	args: { projectId: v.id('projects') },
	returns: v.object({
		moderators: v.array(
			v.object({ assigned: v.boolean(), memberId: v.id('memberships'), profile: profileView })
		),
	}),
	handler: async (ctx, { projectId }) => {
		const access = await manager(ctx, projectId);
		const rows = await ctx.db
			.query('memberships')
			.withIndex('by_organizationId_and_role', (q) =>
				q.eq('organizationId', access.project.organizationId).eq('role', 'moderator')
			)
			.take(201);
		if (rows.length > 200) throw new ConvexError('LIMIT_EXCEEDED');
		const moderators = await Promise.all(
			rows.map(async (row) => {
				const [view, assignment] = await Promise.all([
					profile(ctx, row.userId),
					ctx.db
						.query('projectModeratorAssignments')
						.withIndex('by_membershipId_and_projectId', (q) =>
							q.eq('membershipId', row._id).eq('projectId', projectId)
						)
						.unique(),
				]);
				return view ? { assigned: !!assignment, memberId: row._id, profile: view } : null;
			})
		);
		return { moderators: moderators.filter((row) => row !== null) };
	},
});

export const inviteProjectMember = mutation({
	args: { projectId: v.id('projects'), email: v.string() },
	returns: v.object({ success: v.boolean() }),
	handler: async (ctx, { projectId, email: raw }) => {
		assertProjectWritable(await manager(ctx, projectId));
		const parsed = emailSchema.safeParse(raw.trim().toLowerCase());
		if (!parsed.success) throw new ConvexError('INVALID_INPUT');
		const email = parsed.data;
		// Exact, verified-email lookup is available only after project-manager authorization.
		const candidates = await Promise.all([
			ctx.db
				.query('users')
				.withIndex('by_passwordEmail', (q) => q.eq('passwordEmail', email))
				.take(2),
			ctx.db
				.query('users')
				.withIndex('by_githubEmail', (q) => q.eq('githubEmail', email))
				.take(2),
		]);
		if (candidates.some((rows) => rows.length > 1))
			throw new ConvexError({ code: 'BAD_REQUEST', appErrorCode: 'ACCOUNT_NOT_FOUND_FOR_EMAIL' });
		const users = [
			...new Map(
				candidates
					.flat()
					.filter(
						(user) =>
							user.status === 'active' &&
							((user.passwordEmail === email && user.passwordEmailVerifiedAt !== undefined) ||
								(user.githubEmail === email && user.githubEmailVerifiedAt !== undefined))
					)
					.map((user) => [user._id, user])
			).values(),
		];
		if (users.length !== 1)
			throw new ConvexError({ code: 'BAD_REQUEST', appErrorCode: 'ACCOUNT_NOT_FOUND_FOR_EMAIL' });
		const user = users[0];
		if (!(await profile(ctx, user._id)))
			throw new ConvexError({ code: 'BAD_REQUEST', appErrorCode: 'ACCOUNT_NOT_READY' });
		const existing = await ctx.db
			.query('projectMembers')
			.withIndex('by_projectId_and_userId', (q) =>
				q.eq('projectId', projectId).eq('userId', user._id)
			)
			.unique();
		if (existing)
			throw new ConvexError({
				code: 'CONFLICT',
				appErrorCode: 'PROJECT_MEMBER_ALREADY_HAS_ACCESS',
			});
		const count = await ctx.db
			.query('projectMembers')
			.withIndex('by_projectId_and_userId', (q) => q.eq('projectId', projectId))
			.take(200);
		if (count.length === 200) throw new ConvexError('LIMIT_EXCEEDED');
		await ctx.db.insert('projectMembers', { projectId, userId: user._id });
		return { success: true };
	},
});

export const removeProjectMember = mutation({
	args: { projectMemberId: v.id('projectMembers') },
	returns: v.object({ success: v.boolean() }),
	handler: async (ctx, { projectMemberId }) => {
		const row = await ctx.db.get('projectMembers', projectMemberId);
		if (!row) throw new ConvexError('NOT_FOUND');
		assertProjectWritable(await manager(ctx, row.projectId));
		await ctx.db.delete('projectMembers', projectMemberId);
		return { success: true };
	},
});

export const setModeratorAccess = mutation({
	args: { projectId: v.id('projects'), memberId: v.id('memberships'), enabled: v.boolean() },
	returns: v.object({ success: v.boolean() }),
	handler: async (ctx, { projectId, memberId, enabled }) => {
		const access = await manager(ctx, projectId);
		assertProjectWritable(access);
		const member = await ctx.db.get('memberships', memberId);
		if (
			!member ||
			member.organizationId !== access.project.organizationId ||
			member.role !== 'moderator'
		)
			throw new ConvexError('FORBIDDEN');
		const existing = await ctx.db
			.query('projectModeratorAssignments')
			.withIndex('by_membershipId_and_projectId', (q) =>
				q.eq('membershipId', memberId).eq('projectId', projectId)
			)
			.unique();
		if (enabled && !existing) {
			const assignments = await ctx.db
				.query('projectModeratorAssignments')
				.withIndex('by_membershipId_and_projectId', (q) => q.eq('membershipId', memberId))
				.take(MAX_PROJECT_ASSIGNMENTS);
			if (assignments.length >= MAX_PROJECT_ASSIGNMENTS) throw new ConvexError('ASSIGNMENT_LIMIT');
			await ctx.db.insert('projectModeratorAssignments', { membershipId: memberId, projectId });
		}
		if (!enabled && existing) await ctx.db.delete('projectModeratorAssignments', existing._id);
		return { success: true };
	},
});
