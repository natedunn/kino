import { CRPCError } from 'kitcn/server';
import { z } from 'zod';

import { authMutation, authQuery } from '../lib/crpc';
import {
	asId,
	findOrganization,
	getCurrentProfile,
	getDoc,
	verifyProjectAccess,
} from '../lib/kino';
import { resolveProfileImageUrl } from '../lib/storage';
import { idSchema } from '../lib/validation';
import { projectModeratorAccessTable } from './schema';

export const getManagementState = authQuery
	.input(z.object({ projectId: idSchema }))
	.query(async ({ ctx, input }) => {
		const access = await verifyProjectAccess(ctx, {
			id: input.projectId,
			userId: ctx.userId,
		});
		if (!access.project || !access.permissions.canManageAccess) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'Only organization owners and admins can manage project access',
			});
		}
		const organization = await findOrganization(ctx, { slug: access.project.orgSlug });
		if (!organization) {
			throw new CRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
		}
		const [members, assignments] = await Promise.all([
			ctx.db
				.query('member')
				.withIndex('organizationId_role', (q) =>
					q.eq('organizationId', organization.id).eq('role', 'moderator')
				)
				.take(200),
			ctx.db
				.query('projectModeratorAccess')
				.withIndex('by_organizationId_and_projectId', (q) =>
					q.eq('organizationId', organization.id).eq('projectId', asId<'project'>(input.projectId))
				)
				.take(200),
		]);
		const assignedMemberIds = new Set(assignments.map((row: any) => row.memberId));
		const moderators = (
			await Promise.all(
				members.map(async (member: any) => {
					const user = await getDoc<'user'>(ctx, member.userId);
					const profile = user ? await getCurrentProfile(ctx, member.userId) : null;
					if (!user || !profile) return null;
					return {
						assigned: assignedMemberIds.has(member._id),
						memberId: member._id,
						profile: {
							id: profile.id,
							imageUrl: await resolveProfileImageUrl(profile),
							name: profile.name ?? user.name ?? null,
							username: profile.username,
						},
					};
				})
			)
		).filter((row): row is NonNullable<typeof row> => row !== null);

		return { moderators };
	});

export const setModeratorAccess = authMutation
	.input(z.object({ enabled: z.boolean(), memberId: idSchema, projectId: idSchema }))
	.mutation(async ({ ctx, input }) => {
		const access = await verifyProjectAccess(ctx, {
			id: input.projectId,
			userId: ctx.userId,
		});
		if (!access.project || !access.permissions.canManageAccess) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'Only organization owners and admins can manage project access',
			});
		}
		const organization = await findOrganization(ctx, { slug: access.project.orgSlug });
		const member = await ctx.orm.query.member.findFirst({ where: { id: input.memberId } });
		if (
			!organization ||
			!member ||
			member.organizationId !== organization.id ||
			member.role !== 'moderator'
		) {
			throw new CRPCError({
				code: 'BAD_REQUEST',
				message: 'The selected member is not a moderator in this organization',
			});
		}
		const existing = await ctx.db
			.query('projectModeratorAccess')
			.withIndex('by_memberId_and_projectId', (q) =>
				q.eq('memberId', member.id).eq('projectId', asId<'project'>(input.projectId))
			)
			.take(5);
		if (input.enabled) {
			if (existing.length === 0) {
				await ctx.orm.insert(projectModeratorAccessTable).values({
					memberId: member.id,
					organizationId: organization.id,
					projectId: asId<'project'>(input.projectId),
					updatedTime: Date.now(),
				});
			}
		} else {
			await Promise.all(
				existing.map((row: any) => ctx.db.delete('projectModeratorAccess', row._id))
			);
		}
		return { success: true };
	});
