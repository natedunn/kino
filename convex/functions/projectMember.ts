import { eq } from 'kitcn/orm';
import { CRPCError } from 'kitcn/server';
import { z } from 'zod';

import { appError } from '../lib/app-error';
import { authMutation, authQuery } from '../lib/crpc';
import {
	asId,
	assertProjectWritable,
	findOrganization,
	getCurrentProfile,
	getDoc,
	verifyProjectAccess,
} from '../lib/kino';
import { createProfileImageUrlCache, resolveProfileImageUrl } from '../lib/storage';
import { emailSchema, idSchema } from '../lib/validation';
import { projectMemberTable } from './schema';

export const listAssignableMembers = authQuery
	.input(
		z.object({
			projectId: idSchema,
		})
	)
	.query(async ({ ctx, input }) => {
		const access = await verifyProjectAccess(ctx, {
			id: input.projectId,
			userId: ctx.userId,
		});
		if (!access.project || !access.permissions.canManageContent) return [];
		const organization = await findOrganization(ctx, { slug: access.project.orgSlug });
		if (!organization) return [];
		const [organizationMembers, assignments] = await Promise.all([
			ctx.db
				.query('member')
				.withIndex('organizationId', (q) => q.eq('organizationId', organization.id))
				.take(200),
			ctx.db
				.query('projectModeratorAccess')
				.withIndex('by_organizationId_and_projectId', (q) =>
					q.eq('organizationId', organization.id).eq('projectId', asId<'project'>(input.projectId))
				)
				.take(200),
		]);
		const assignedModeratorIds = new Set(assignments.map((row: any) => row.memberId));
		const teamMembers = organizationMembers.filter(
			(member: any) =>
				member.role === 'owner' ||
				member.role === 'admin' ||
				(member.role === 'moderator' && assignedModeratorIds.has(member._id))
		);

		const imageUrlCache = createProfileImageUrlCache();
		const rows = await Promise.all(
			teamMembers.map(async (member: any) => {
				const profile = await getCurrentProfile(ctx, member.userId);
				return {
					profile: profile
						? {
								id: profile.id,
								imageUrl: await resolveProfileImageUrl(profile, imageUrlCache),
								name: profile.name ?? null,
								username: profile.username,
							}
						: null,
					profileId: profile?.id ?? null,
					role: member.role,
				};
			})
		);

		return rows.filter((member) => member.profile !== null);
	});

/**
 * Direct, per-project members (role "member"). These exist for PRIVATE projects:
 * an invited user gets normal user-level access to an otherwise-hidden project.
 * Organization owners/admins are resolved from organization membership, while
 * moderators use explicit assignments. Neither is represented or listed here.
 * Member rows are kept when a project is public so access is restored if it
 * becomes private again.
 */
export const listProjectMembers = authQuery
	.input(z.object({ projectId: idSchema }))
	.query(async ({ ctx, input }) => {
		const access = await verifyProjectAccess(ctx, {
			id: input.projectId,
			userId: ctx.userId,
		});
		if (!access.project || !access.permissions.canManageAccess) {
			return { canManage: false, isPrivate: false, members: [] };
		}

		const rows = await ctx.orm.query.projectMember.findMany({
			where: { projectId: asId<'project'>(input.projectId) },
			with: { profile: true },
			limit: 200,
		});

		const imageUrlCache = createProfileImageUrlCache();
		const members = (
			await Promise.all(
				rows
					.filter(
						(member: any) =>
							(member.role === undefined || member.role === null || member.role === 'member') &&
							member.profile
					)
					.map(async (member: any) => ({
						id: member.id,
						profile: {
							id: member.profile._id,
							imageUrl: await resolveProfileImageUrl(member.profile, imageUrlCache),
							name: member.profile.name ?? null,
							username: member.profile.username,
						},
						profileId: member.profileId,
					}))
			)
		).filter(Boolean);

		return {
			canManage: true,
			isPrivate: access.project.visibility === 'private',
			members,
		};
	});

export const inviteProjectMember = authMutation
	.input(z.object({ email: emailSchema, projectId: idSchema }))
	.mutation(async ({ ctx, input }) => {
		const access = await verifyProjectAccess(ctx, {
			id: input.projectId,
			userId: ctx.userId,
		});
		if (!access.project) {
			throw new CRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
		}
		assertProjectWritable(access);
		if (!access.permissions.canManageAccess) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You do not have permission to manage this project',
			});
		}

		// Project members are existing Kino accounts (no email invites yet).
		const user = await ctx.orm.query.user.findFirst({
			where: { email: input.email },
		});
		if (!user) {
			throw appError({
				appCode: 'ACCOUNT_NOT_FOUND_FOR_EMAIL',
				code: 'BAD_REQUEST',
				message: 'No Kino account exists with that email',
			});
		}
		const profile = await ctx.orm.query.profile.findFirst({
			where: { userId: user.id },
		});
		if (!profile) {
			throw appError({
				appCode: 'ACCOUNT_NOT_READY',
				code: 'BAD_REQUEST',
				message: 'That account is not set up yet',
			});
		}

		const profileId = asId<'profile'>((profile as any)._id ?? (profile as any).id);
		const existing = await ctx.orm.query.projectMember.findMany({
			where: {
				profileId,
				projectId: asId<'project'>(input.projectId),
			},
			limit: 1,
		});
		if (existing.length > 0) {
			throw appError({
				appCode: 'PROJECT_MEMBER_ALREADY_HAS_ACCESS',
				code: 'CONFLICT',
				message: 'That person already has access to this project',
			});
		}

		await ctx.orm.insert(projectMemberTable).values({
			profileId: profileId,
			projectId: access.project.id,
			projectSlug: access.project.slug,
			projectVisibility: access.project.visibility,
		});

		return { success: true };
	});

export const removeProjectMember = authMutation
	.input(z.object({ projectMemberId: idSchema }))
	.mutation(async ({ ctx, input }) => {
		const membership = await getDoc<'projectMember'>(
			ctx,
			asId<'projectMember'>(input.projectMemberId)
		);
		if (!membership) {
			throw new CRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
		}
		// Only direct project members can be removed here. Organization roles and
		// moderator assignments are managed through their dedicated APIs.
		if (membership.role !== undefined && membership.role !== null && membership.role !== 'member') {
			throw appError({
				appCode: 'PROJECT_MEMBER_ORG_MANAGED',
				code: 'BAD_REQUEST',
				message: 'That access is managed at the organization level',
			});
		}

		const access = await verifyProjectAccess(ctx, {
			id: membership.projectId,
			userId: ctx.userId,
		});
		assertProjectWritable(access);
		if (!access.permissions.canManageAccess) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You do not have permission to manage this project',
			});
		}

		await ctx.orm
			.delete(projectMemberTable)
			.where(eq(projectMemberTable.id, membership._id as any));

		return { success: true };
	});
