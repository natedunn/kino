import { z } from "zod"
import { eq } from "kitcn/orm"
import { CRPCError } from "kitcn/server"
import { authMutation, authQuery } from "../lib/crpc"
import {
  asId,
  getDoc,
  isProjectEditorRole,
  verifyProjectAccess,
} from "../lib/kino"
import { resolveProfileImageUrl } from "../lib/storage"
import { emailSchema, idSchema } from "../lib/validation"
import { projectMemberTable } from "./schema"

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
    })
    if (!access.permissions.canView) return []

    const projectMembers = await ctx.orm.query.projectMember.findMany({
      where: { projectId: asId<"project">(input.projectId) },
      with: { profile: true },
      limit: 200,
    })

    const membersWithProfiles = await Promise.all(
      projectMembers.map(async (member: any) => ({
        profile: member.profile ?? null,
        profileId: member.profileId,
        role: member.role,
      }))
    )

    const rows = await Promise.all(
      membersWithProfiles
        .filter((member) => isProjectEditorRole(member.role))
        .map(async (member) => ({
          profile: member.profile
            ? {
                id: member.profile._id,
                imageUrl: await resolveProfileImageUrl(member.profile),
                name: member.profile.name ?? null,
                username: member.profile.username,
              }
            : null,
          profileId: member.profileId,
          role: member.role,
        }))
    )

    return rows.filter((member) => member.profile !== null)
  })

/**
 * Direct, per-project members (role "member"). These exist for PRIVATE projects:
 * an invited user gets normal user-level access to an otherwise-hidden project.
 * Org admins/editors get project access via the derived org:admin/org:editor
 * rows instead and are not listed here. Member rows are kept even when a project
 * is public (harmless — everyone can view) so access is restored if it goes
 * private again.
 */
export const listProjectMembers = authQuery
  .input(z.object({ projectId: idSchema }))
  .query(async ({ ctx, input }) => {
    const access = await verifyProjectAccess(ctx, {
      id: input.projectId,
      userId: ctx.userId,
    })
    if (!access.project || !access.permissions.canEdit) {
      return { canManage: false, isPrivate: false, members: [] }
    }

    const rows = await ctx.orm.query.projectMember.findMany({
      where: { projectId: asId<"project">(input.projectId) },
      with: { profile: true },
      limit: 200,
    })

    const members = (
      await Promise.all(
        rows
          .filter((member: any) => member.role === "member" && member.profile)
          .map(async (member: any) => ({
            id: member.id,
            profile: {
              id: member.profile._id,
              imageUrl: await resolveProfileImageUrl(member.profile),
              name: member.profile.name ?? null,
              username: member.profile.username,
            },
            profileId: member.profileId,
          }))
      )
    ).filter(Boolean)

    return {
      canManage: true,
      isPrivate: access.project.visibility === "private",
      members,
    }
  })

export const inviteProjectMember = authMutation
  .input(z.object({ email: emailSchema, projectId: idSchema }))
  .mutation(async ({ ctx, input }) => {
    const access = await verifyProjectAccess(ctx, {
      id: input.projectId,
      userId: ctx.userId,
    })
    if (!access.project) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Project not found" })
    }
    if (!access.permissions.canEdit) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to manage this project",
      })
    }

    // Project members are existing Kino accounts (no email invites yet).
    const user = await ctx.orm.query.user.findFirst({
      where: { email: input.email },
    })
    if (!user) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "No Kino account exists with that email",
      })
    }
    const profile = await ctx.orm.query.profile.findFirst({
      where: { userId: user.id },
    })
    if (!profile) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "That account is not set up yet",
      })
    }

    const profileId = asId<"profile">(
      (profile as any)._id ?? (profile as any).id
    )
    const existing = await ctx.orm.query.projectMember.findMany({
      where: {
        profileId,
        projectId: asId<"project">(input.projectId),
      },
      limit: 1,
    })
    if (existing.length > 0) {
      throw new CRPCError({
        code: "CONFLICT",
        message: "That person already has access to this project",
      })
    }

    await ctx.orm.insert(projectMemberTable).values({
      profileId: profileId as any,
      projectId: access.project.id as any,
      projectSlug: access.project.slug,
      projectVisibility: access.project.visibility,
      role: "member",
    })

    return { success: true }
  })

export const removeProjectMember = authMutation
  .input(z.object({ projectMemberId: idSchema }))
  .mutation(async ({ ctx, input }) => {
    const membership = await getDoc<"projectMember">(
      ctx,
      asId<"projectMember">(input.projectMemberId)
    )
    if (!membership) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Member not found" })
    }
    // Only direct project members can be removed here; org-derived access
    // (org:admin/org:editor) is managed at the org level.
    if (membership.role !== "member") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "That access is managed at the organization level",
      })
    }

    const access = await verifyProjectAccess(ctx, {
      id: membership.projectId,
      userId: ctx.userId,
    })
    if (!access.permissions.canEdit) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to manage this project",
      })
    }

    await ctx.orm
      .delete(projectMemberTable)
      .where(eq(projectMemberTable.id, membership._id as any))

    return { success: true }
  })
