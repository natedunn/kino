import { CRPCError } from 'kitcn/server';
import { z } from 'zod';

import { authMutation, authQuery } from '../lib/crpc';
import { asId, findOrganization, getDoc, verifyOrgAccess } from '../lib/kino';
import { emailSchema, idSchema, orgSlugSchema } from '../lib/validation';
import { assignableRoleSchema, requireOrgManage, updatableRoleSchema } from './orgMember.lib';
import { pendingModeratorProjectAccessTable, projectModeratorAccessTable } from './schema';

const projectIdsSchema = z.array(idSchema).max(200);

async function validateOrganizationProjects(
	ctx: any,
	args: { organizationId: string; projectIds: Array<string> }
) {
	const organization = await findOrganization(ctx, { id: args.organizationId });
	if (!organization) {
		throw new CRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
	}
	const uniqueIds = [...new Set(args.projectIds)];
	const projects = await Promise.all(
		uniqueIds.map((projectId) => getDoc<'project'>(ctx, asId<'project'>(projectId)))
	);
	if (
		projects.some(
			(project) => !project || project.deletedTime != null || project.orgSlug !== organization.slug
		)
	) {
		throw new CRPCError({
			code: 'BAD_REQUEST',
			message: 'Every selected project must belong to this organization',
		});
	}
	return {
		organization,
		projectIds: uniqueIds.map((id) => asId<'project'>(id)),
		projects: projects.filter(Boolean),
	};
}

async function deleteModeratorAssignments(ctx: any, memberId: string) {
	const rows = await ctx.db
		.query('projectModeratorAccess')
		.withIndex('by_memberId_and_projectId', (q: any) => q.eq('memberId', memberId))
		.take(500);
	await Promise.all(rows.map((row: any) => ctx.db.delete('projectModeratorAccess', row._id)));
}

async function replaceModeratorAssignments(
	ctx: any,
	args: { member: any; projectIds: Array<string> }
) {
	if (args.member.role !== 'moderator') {
		throw new CRPCError({
			code: 'BAD_REQUEST',
			message: 'Project access can only be assigned to moderators',
		});
	}
	const validated = await validateOrganizationProjects(ctx, {
		organizationId: args.member.organizationId,
		projectIds: args.projectIds,
	});
	await deleteModeratorAssignments(ctx, args.member.id);
	await Promise.all(
		validated.projectIds.map((projectId) =>
			ctx.orm.insert(projectModeratorAccessTable).values({
				memberId: args.member.id,
				organizationId: args.member.organizationId,
				projectId,
				updatedTime: Date.now(),
			})
		)
	);
}

async function deletePendingAssignments(ctx: any, invitationId: string) {
	const rows = await ctx.db
		.query('pendingModeratorProjectAccess')
		.withIndex('by_invitationId_and_projectId', (q: any) => q.eq('invitationId', invitationId))
		.take(200);
	await Promise.all(
		rows.map((row: any) => ctx.db.delete('pendingModeratorProjectAccess', row._id))
	);
}

export const listMembers = authQuery
	.input(z.object({ slug: orgSlugSchema }))
	.query(async ({ ctx, input }) => {
		const access = await verifyOrgAccess(ctx, {
			slug: input.slug,
			userId: ctx.userId,
		});
		if (!access.organization || !access.permissions.canDelete) {
			return { canManage: false, currentUserRole: null, members: [] };
		}

		const organizationId: string = access.organization.id;
		const members = await ctx.orm.query.member.findMany({
			where: { organizationId },
			limit: 200,
		});

		const enriched = (
			await Promise.all(
				members.map(async (m: any) => {
					const [user, assignments] = await Promise.all([
						getDoc<'user'>(ctx, m.userId),
						m.role === 'moderator'
							? ctx.db
									.query('projectModeratorAccess')
									.withIndex('by_memberId_and_projectId', (q: any) => q.eq('memberId', m.id))
									.take(500)
							: Promise.resolve([]),
					]);
					return user
						? {
								assignedProjectCount: assignments.length,
								id: m.id,
								role: m.role,
								user: {
									email: user.email,
									id: user._id,
									image: user.image ?? null,
									name: user.name,
								},
								userId: m.userId,
							}
						: null;
				})
			)
		).filter((m): m is NonNullable<typeof m> => m !== null);

		return {
			// owner/admin (canDelete) may manage members
			canManage: access.permissions.canDelete,
			currentUserRole: access.member?.role ?? null,
			members: enriched,
		};
	});

export const inviteMember = authMutation
	.input(
		z.object({
			email: emailSchema,
			organizationId: idSchema,
			projectIds: projectIdsSchema.optional(),
			role: assignableRoleSchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		await requireOrgManage(ctx, { id: input.organizationId });
		if (input.role === 'moderator' && input.projectIds === undefined) {
			throw new CRPCError({
				code: 'BAD_REQUEST',
				message: 'Choose projects for the moderator, or explicitly choose none',
			});
		}
		if (input.role !== 'moderator' && input.projectIds !== undefined) {
			throw new CRPCError({
				code: 'BAD_REQUEST',
				message: 'Project selections are only valid for moderators',
			});
		}
		const validated =
			input.role === 'moderator'
				? await validateOrganizationProjects(ctx, {
						organizationId: input.organizationId,
						projectIds: input.projectIds ?? [],
					})
				: null;

		const invitation: any = await ctx.auth.api.createInvitation({
			body: {
				email: input.email,
				organizationId: input.organizationId,
				role: input.role,
			},
			headers: ctx.headers,
		});
		const invitationId = invitation?.id ?? invitation?._id;
		if (!invitationId) {
			throw new CRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Invitation was created without an identifier',
			});
		}
		if (validated && invitationId) {
			await Promise.all(
				validated.projectIds.map((projectId) =>
					ctx.orm.insert(pendingModeratorProjectAccessTable).values({
						invitationId,
						organizationId: input.organizationId,
						projectId,
						updatedTime: Date.now(),
					})
				)
			);
		}
		return { success: true };
	});

export const updateMemberRole = authMutation
	.input(
		z.object({
			memberId: idSchema,
			projectIds: projectIdsSchema.optional(),
			role: updatableRoleSchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const member = await ctx.orm.query.member.findFirst({
			where: { id: input.memberId },
		});
		if (!member) {
			throw new CRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
		}
		if (input.role === 'moderator' && input.projectIds === undefined) {
			throw new CRPCError({
				code: 'BAD_REQUEST',
				message: 'Choose projects for the moderator, or explicitly choose none',
			});
		}
		if (input.role !== 'moderator' && input.projectIds !== undefined) {
			throw new CRPCError({
				code: 'BAD_REQUEST',
				message: 'Project selections are only valid for moderators',
			});
		}

		const access = await requireOrgManage(ctx, { id: member.organizationId });

		// Only an owner may grant or revoke the owner role.
		const touchesOwner = input.role === 'owner' || member.role === 'owner';
		if (touchesOwner && access.member?.role !== 'owner') {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'Only an owner can change owner roles',
			});
		}

		// Never let the last owner be demoted — that would strand the org with no
		// one able to manage membership. Mirrors the guard in `leaveOrganization`
		// and `removeMember`. Ownership must be transferred (promote another member
		// to owner) before the sole owner steps down.
		if (member.role === 'owner' && input.role !== 'owner') {
			const owners = await ctx.orm.query.member.findMany({
				where: { organizationId: member.organizationId, role: 'owner' },
				limit: 2,
			});
			if (owners.length <= 1) {
				throw new CRPCError({
					code: 'FORBIDDEN',
					message: 'Promote another owner before demoting the only owner',
				});
			}
		}

		await ctx.auth.api.updateMemberRole({
			body: {
				memberId: input.memberId,
				organizationId: member.organizationId,
				role: input.role,
			},
			headers: ctx.headers,
		});
		await deleteModeratorAssignments(ctx, input.memberId);
		if (input.role === 'moderator') {
			await replaceModeratorAssignments(ctx, {
				member: { ...member, role: 'moderator' },
				projectIds: input.projectIds ?? [],
			});
		}
		return { success: true };
	});

export const getModeratorProjectAccess = authQuery
	.input(z.object({ memberId: idSchema }))
	.query(async ({ ctx, input }) => {
		const member = await ctx.orm.query.member.findFirst({ where: { id: input.memberId } });
		if (!member) {
			throw new CRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
		}
		await requireOrgManage(ctx, { id: member.organizationId });
		const organization = await findOrganization(ctx, { id: member.organizationId });
		if (!organization) {
			throw new CRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
		}
		const [projects, assignments] = await Promise.all([
			ctx.db
				.query('project')
				.withIndex('by_orgSlug', (q: any) => q.eq('orgSlug', organization.slug))
				.order('desc')
				.take(200),
			ctx.db
				.query('projectModeratorAccess')
				.withIndex('by_memberId_and_projectId', (q: any) => q.eq('memberId', input.memberId))
				.take(500),
		]);
		const assigned = new Set(assignments.map((row: any) => row.projectId));
		return {
			memberId: member.id,
			projects: projects
				.filter((project: any) => project.deletedTime == null)
				.map((project: any) => ({
					assigned: assigned.has(project._id),
					id: project._id,
					name: project.name,
					slug: project.slug,
					visibility: project.visibility,
				})),
		};
	});

export const setModeratorProjectAccess = authMutation
	.input(z.object({ memberId: idSchema, projectIds: projectIdsSchema }))
	.mutation(async ({ ctx, input }) => {
		const member = await ctx.orm.query.member.findFirst({ where: { id: input.memberId } });
		if (!member) {
			throw new CRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
		}
		await requireOrgManage(ctx, { id: member.organizationId });
		await replaceModeratorAssignments(ctx, {
			member,
			projectIds: input.projectIds,
		});
		return { success: true };
	});

export const acceptInvitation = authMutation
	.input(z.object({ invitationId: idSchema }))
	.mutation(async ({ ctx, input }) => {
		const invitation = await ctx.orm.query.invitation.findFirst({
			where: { id: input.invitationId },
		});
		if (!invitation) {
			throw new CRPCError({ code: 'NOT_FOUND', message: 'Invitation not found' });
		}
		const pending = await ctx.db
			.query('pendingModeratorProjectAccess')
			.withIndex('by_invitationId_and_projectId', (q: any) =>
				q.eq('invitationId', input.invitationId)
			)
			.take(200);
		const currentUser = await getDoc<'user'>(ctx, ctx.userId);
		if (!currentUser) {
			throw new CRPCError({ code: 'UNAUTHORIZED', message: 'User not found' });
		}
		if (invitation.status === 'accepted') {
			if (currentUser.email.toLowerCase() !== invitation.email.toLowerCase()) {
				throw new CRPCError({
					code: 'FORBIDDEN',
					message: 'This invitation belongs to a different account',
				});
			}
		} else {
			await ctx.auth.api.acceptInvitation({
				body: { invitationId: input.invitationId },
				headers: ctx.headers,
			});
		}
		let member = await ctx.orm.query.member.findFirst({
			where: {
				organizationId: invitation.organizationId,
				userId: ctx.userId,
			},
		});
		if (!member) {
			throw new CRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Invitation was accepted but membership could not be resolved',
			});
		}
		if (invitation.role === 'editor' || member.role === 'editor') {
			// Compatibility only: the authenticated recipient cannot call Better
			// Auth's admin-only update-role endpoint. Normalize the member row that
			// was just created from the matching legacy invitation.
			await ctx.db.patch('member', asId<'member'>(member.id), { role: 'moderator' });
			member = { ...member, role: 'moderator' };
		}
		if (member.role === 'moderator') {
			await replaceModeratorAssignments(ctx, {
				member,
				projectIds: pending.map((row: any) => row.projectId),
			});
		}
		await deletePendingAssignments(ctx, input.invitationId);
		const organization = await findOrganization(ctx, { id: invitation.organizationId });
		return { organizationSlug: organization?.slug ?? null, success: true };
	});

export const removeMember = authMutation
	.input(z.object({ memberId: idSchema }))
	.mutation(async ({ ctx, input }) => {
		const member = await ctx.orm.query.member.findFirst({
			where: { id: input.memberId },
		});
		if (!member) {
			throw new CRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
		}

		await requireOrgManage(ctx, { id: member.organizationId });

		if (member.role === 'owner') {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'Transfer ownership before removing an owner',
			});
		}

		await deleteModeratorAssignments(ctx, input.memberId);
		await ctx.auth.api.removeMember({
			body: {
				memberIdOrEmail: input.memberId,
				organizationId: member.organizationId,
			},
			headers: ctx.headers,
		});
		return { success: true };
	});

export const leaveOrganization = authMutation
	.input(z.object({ organizationId: idSchema }))
	.mutation(async ({ ctx, input }) => {
		const me = await ctx.orm.query.member.findFirst({
			where: { organizationId: input.organizationId, userId: ctx.userId },
		});
		if (!me) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You are not a member of this organization',
			});
		}

		if (me.role === 'owner') {
			const owners = await ctx.orm.query.member.findMany({
				where: { organizationId: input.organizationId, role: 'owner' },
				limit: 2,
			});
			if (owners.length <= 1) {
				throw new CRPCError({
					code: 'FORBIDDEN',
					message: 'Transfer ownership before leaving as the only owner',
				});
			}
		}

		await deleteModeratorAssignments(ctx, me.id);
		await ctx.auth.api.leaveOrganization({
			body: { organizationId: input.organizationId },
			headers: ctx.headers,
		});
		return { success: true };
	});

export const listPendingInvitations = authQuery
	.input(z.object({ slug: orgSlugSchema }))
	.query(async ({ ctx, input }) => {
		const access = await verifyOrgAccess(ctx, {
			slug: input.slug,
			userId: ctx.userId,
		});
		if (!access.organization || !access.permissions.canDelete) return [];

		const organizationId: string = access.organization.id;
		const invitations = await ctx.orm.query.invitation.findMany({
			where: { organizationId, status: 'pending' },
			limit: 100,
		});

		return await Promise.all(
			invitations.map(async (inv: any) => {
				const pending = await ctx.db
					.query('pendingModeratorProjectAccess')
					.withIndex('by_invitationId_and_projectId', (q: any) => q.eq('invitationId', inv.id))
					.take(200);
				return {
					assignedProjectCount: pending.length,
					email: inv.email,
					expiresAt: inv.expiresAt,
					id: inv.id,
					role: inv.role === 'editor' ? 'moderator' : (inv.role ?? 'moderator'),
				};
			})
		);
	});

export const cancelInvitation = authMutation
	.input(z.object({ invitationId: idSchema }))
	.mutation(async ({ ctx, input }) => {
		const invitation = await ctx.orm.query.invitation.findFirst({
			where: { id: input.invitationId },
		});
		if (!invitation) {
			throw new CRPCError({
				code: 'NOT_FOUND',
				message: 'Invitation not found',
			});
		}

		await requireOrgManage(ctx, { id: invitation.organizationId });

		await deletePendingAssignments(ctx, input.invitationId);
		await ctx.auth.api.cancelInvitation({
			body: { invitationId: input.invitationId },
			headers: ctx.headers,
		});
		return { success: true };
	});

export const rejectInvitation = authMutation
	.input(z.object({ invitationId: idSchema }))
	.mutation(async ({ ctx, input }) => {
		const invitation = await ctx.orm.query.invitation.findFirst({
			where: { id: input.invitationId },
		});
		if (!invitation) {
			throw new CRPCError({ code: 'NOT_FOUND', message: 'Invitation not found' });
		}
		await ctx.auth.api.rejectInvitation({
			body: { invitationId: input.invitationId },
			headers: ctx.headers,
		});
		await deletePendingAssignments(ctx, input.invitationId);
		return { success: true };
	});
