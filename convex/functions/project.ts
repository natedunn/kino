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

const urlSchema = z.object({
  text: z.string().min(1).max(100),
  url: z.string().url(),
})

const visibilitySchema = z.enum(["public", "private", "archived"])

export const create = authMutation
  .input(
    z.object({
      description: z.string().max(250).optional(),
      name: z.string().min(1).max(30),
      orgSlug: z.string(),
      slug: z.string().min(1).max(30),
      urls: z.array(urlSchema).max(10).optional(),
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
      description: z.string().max(250).optional(),
      id: z.string(),
      name: z.string().min(1).max(30).optional(),
      orgSlug: z.string().optional(),
      slug: z.string().min(1).max(30).optional(),
      urls: z.array(urlSchema).max(10).optional(),
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
      orgSlug: z.string(),
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
    const memberProjectIds = new Set(
      memberships.map((membership: any) => String(membership.projectId))
    )

    let memberPrivateProjects: typeof publicProjects = []
    if (memberProjectIds.size > 0) {
      const privateProjects = await ctx.orm.query.project.findMany({
        where: { orgSlug: input.orgSlug, visibility: "private" },
        limit,
        orderBy: { updatedTime: "desc" },
      })
      memberPrivateProjects = privateProjects.filter((project: any) =>
        memberProjectIds.has(String(project._id ?? project.id))
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
      orgSlug: z.string(),
      slug: z.string(),
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
