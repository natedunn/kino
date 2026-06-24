import { z } from "zod"
import { CRPCError } from "kitcn/server"
import { eq } from "kitcn/orm"
import { authMutation, optionalAuthQuery } from "../lib/crpc"
import { projectTable } from "./schema"
import {
  LIMITS,
  asId,
  getCurrentProfile,
  toPublicDoc,
  verifyOrgAccess,
  verifyProjectAccess,
} from "../lib/kino"
import {
  idSchema,
  orgSlugSchema,
  projectDescriptionSchema,
  projectNameSchema,
  projectSlugSchema,
  projectSlugWriteSchema,
  urlListSchema,
} from "../lib/validation"

const visibilitySchema = z.enum(["public", "private", "archived"])

export const create = authMutation
  .input(
    z.object({
      description: projectDescriptionSchema.optional(),
      name: projectNameSchema,
      orgSlug: orgSlugSchema,
      slug: projectSlugWriteSchema,
      urls: urlListSchema.optional(),
      visibility: visibilitySchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const access = await verifyOrgAccess(ctx, {
      slug: input.orgSlug,
      userId: ctx.userId,
    })
    if (!access.organization) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      })
    }

    if (!access.permissions.canCreate) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "User does not have permission to create a project",
      })
    }

    const projects = await ctx.orm.query.project.findMany({
      where: { orgSlug: input.orgSlug },
      limit: LIMITS.ADMIN.MAX_PROJECTS + 1,
    })
    const maxProjects =
      access.profile.role === "system:admin"
        ? LIMITS.ADMIN.MAX_PROJECTS
        : LIMITS.FREE.MAX_PROJECTS
    if (projects.length >= maxProjects) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Project limit reached",
      })
    }

    const existing = await ctx.db
      .query("project")
      .withIndex("by_orgSlug_slug", (q: any) =>
        q.eq("orgSlug", input.orgSlug).eq("slug", input.slug)
      )
      .unique()
    if (existing) {
      throw new CRPCError({
        code: "CONFLICT",
        message: `A project with the slug '${input.slug}' already exists for this organization.`,
      })
    }

    const [project] = await ctx.orm
      .insert(projectTable)
      .values({
        description: input.description ?? null,
        logoUrl: null,
        name: input.name,
        orgSlug: input.orgSlug,
        slug: input.slug,
        urls: input.urls ?? null,
        visibility: input.visibility,
      })
      .returning()

    return project
  })

export const update = authMutation
  .input(
    z.object({
      description: projectDescriptionSchema.optional(),
      id: idSchema,
      name: projectNameSchema.optional(),
      orgSlug: orgSlugSchema.optional(),
      slug: projectSlugWriteSchema.optional(),
      urls: urlListSchema.optional(),
      visibility: visibilitySchema.optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const access = await verifyProjectAccess(ctx, {
      id: input.id,
      userId: ctx.userId,
    })
    if (!access.project) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Project not found" })
    }
    if (!access.permissions.canEdit) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "User does not have permission",
      })
    }

    if (input.slug && input.slug !== access.project.slug) {
      const existing = await ctx.db
        .query("project")
        .withIndex("by_orgSlug_slug", (q: any) =>
          q
            .eq("orgSlug", input.orgSlug ?? access.project.orgSlug)
            .eq("slug", input.slug)
        )
        .unique()
      if (existing && existing._id !== access.project._id) {
        throw new CRPCError({
          code: "CONFLICT",
          message: `A project with the slug '${input.slug}' already exists for this organization.`,
        })
      }
    }

    const patch = Object.fromEntries(
      Object.entries({
        description: input.description,
        name: input.name,
        orgSlug: input.orgSlug,
        slug: input.slug,
        urls: input.urls,
        visibility: input.visibility,
      }).filter(([, value]) => value !== undefined)
    )

    await ctx.orm
      .update(projectTable)
      .set(patch)
      .where(eq(projectTable.id, access.project._id as any))
    return {
      ...access.project,
      ...patch,
    }
  })

export const getManyByOrg = optionalAuthQuery
  .input(
    z.object({
      limit: z.number().min(1).max(100).optional(),
      orgSlug: orgSlugSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const limit = input.limit ?? 10
    const publicProjects = await ctx.orm.query.project.findMany({
      where: { orgSlug: input.orgSlug, visibility: "public" },
      limit,
      orderBy: { updatedTime: "desc" },
    })

    const access = ctx.userId
      ? await verifyOrgAccess(ctx, { slug: input.orgSlug, userId: ctx.userId })
      : null

    // Org managers (admin/editor/owner) and system roles see every project.
    // A public org's canView does NOT imply private-project visibility, so we
    // gate private/archived on canEdit, not canView.
    if (access?.permissions.canEdit) {
      const [privateProjects, archivedProjects] = await Promise.all([
        ctx.orm.query.project.findMany({
          where: { orgSlug: input.orgSlug, visibility: "private" },
          limit,
          orderBy: { updatedTime: "desc" },
        }),
        ctx.orm.query.project.findMany({
          where: { orgSlug: input.orgSlug, visibility: "archived" },
          limit,
          orderBy: { updatedTime: "desc" },
        }),
      ])

      const merged = [
        ...publicProjects,
        ...privateProjects,
        ...archivedProjects,
      ]
        .sort((a, b) => (b.updatedTime ?? 0) - (a.updatedTime ?? 0))
        .slice(0, limit)

      return merged.length > 0 ? merged : null
    }

    // Everyone else: public projects, plus any PRIVATE project the current
    // user is a direct member of (so invited members can reach it). No archived.
    const profile = ctx.userId ? await getCurrentProfile(ctx, ctx.userId) : null
    if (!profile) {
      return publicProjects.length > 0 ? publicProjects : null
    }

    const memberships = await ctx.orm.query.projectMember.findMany({
      where: { profileId: asId<"profile">(profile._id) },
      limit: 500,
    })
    const memberProjectIds = memberships.map((membership: any) =>
      asId<"project">(membership.projectId)
    )

    // Load the member's projects directly by id (point lookups) so visibility
    // doesn't depend on a recency window of the org's private projects.
    let memberPrivateProjects: typeof publicProjects = []
    if (memberProjectIds.length > 0) {
      const memberProjects = await ctx.orm.query.project.findMany({
        where: { id: { in: memberProjectIds } },
        limit: 500,
      })
      memberPrivateProjects = memberProjects.filter(
        (project: any) =>
          project.orgSlug === input.orgSlug && project.visibility === "private"
      )
    }

    const merged = [...publicProjects, ...memberPrivateProjects]
      .sort((a, b) => (b.updatedTime ?? 0) - (a.updatedTime ?? 0))
      .slice(0, limit)

    return merged.length > 0 ? merged : null
  })

export const getDetails = optionalAuthQuery
  .input(
    z.object({
      orgSlug: orgSlugSchema,
      slug: projectSlugSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const project = await ctx.db
      .query("project")
      .withIndex("by_orgSlug_slug", (q: any) =>
        q.eq("orgSlug", input.orgSlug).eq("slug", input.slug)
      )
      .unique()
    if (!project) return null

    const access = await verifyProjectAccess(ctx, {
      id: project._id,
      userId: ctx.userId,
    })
    if (!access.project || !access.permissions.canView) {
      return null
    }

    return {
      ...access,
      profile: toPublicDoc(access.profile),
      project: toPublicDoc(access.project),
      projectMember: toPublicDoc(access.projectMember),
    }
  })
