import { CRPCError } from 'kitcn/server';
import { z } from 'zod';

import { authMutation, authQuery } from '../lib/crpc';
import { getDoc, verifyOrgAccess } from '../lib/kino';
import { emailSchema, idSchema, orgSlugSchema } from '../lib/validation';
import { assignableRoleSchema, requireOrgManage, updatableRoleSchema } from './orgMember.lib';

export const listMembers = authQuery
	.input(z.object({ slug: orgSlugSchema }))
	.query(async ({ ctx, input }) => {
		const access = await verifyOrgAccess(ctx, {
			slug: input.slug,
			userId: ctx.userId,
		});
		if (!access.organization || !access.permissions.canView) {
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
					const user = await getDoc<'user'>(ctx, m.userId);
					return user
						? {
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
			role: assignableRoleSchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		await requireOrgManage(ctx, { id: input.organizationId });

		await ctx.auth.api.createInvitation({
			body: {
				email: input.email,
				organizationId: input.organizationId,
				role: input.role,
			},
			headers: ctx.headers,
		});
		return { success: true };
	});

export const updateMemberRole = authMutation
	.input(
		z.object({
			memberId: idSchema,
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
		return { success: true };
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

		return invitations.map((inv: any) => ({
			email: inv.email,
			expiresAt: inv.expiresAt,
			id: inv.id,
			role: inv.role ?? 'editor',
		}));
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

		await ctx.auth.api.cancelInvitation({
			body: { invitationId: input.invitationId },
			headers: ctx.headers,
		});
		return { success: true };
	});
