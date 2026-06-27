import { createFunctionHandle } from "convex/server"
import { ConvexError, v } from "convex/values"
import { z } from "zod"
import { CRPCError } from "kitcn/server"
import { authMutation, authQuery, optionalAuthQuery } from "../lib/crpc"
import {
  LIMITS,
  ensureUniqueOrgSlug,
  findOrganization,
  getCurrentProfile,
  verifyOrgAccess,
} from "../lib/kino"
import {
  idSchema,
  httpUrlSchema,
  orgNameSchema,
  orgSlugSchema,
  orgSlugWriteSchema,
  storageKeySchema,
} from "../lib/validation"
import {
  getOrgUploadR2Metadata,
  getOrganizationLogoObjectKey,
  resolveOrganizationLogoUrl,
  updateOrgStorageUsage,
  validateOrganizationLogoMetadata,
} from "../lib/storage"
import { orgUploadsR2 } from "../lib/r2"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { internalMutation } from "./generated/server"

const visibilitySchema = z.enum(["public", "private"])

function parseOrgAvatarKey(key: string) {
  const objectKey = getOrganizationLogoObjectKey(key) ?? key
  const [type, organizationId] = objectKey.split(".")
  if (type !== "ORG_AVATAR" || !organizationId) {
    throw new ConvexError({
      code: "400",
      message: "Invalid key format for organization avatar upload",
    })
  }

  return organizationId as Id<"organization">
}

async function withResolvedLogo<T extends { logo?: string | null }>(
  organization: T
) {
  return {
    ...organization,
    logo: await resolveOrganizationLogoUrl(organization),
  }
}

export const create = authMutation
  .input(
    z.object({
      logo: httpUrlSchema.optional(),
      name: orgNameSchema,
      slug: orgSlugWriteSchema.optional(),
      visibility: visibilitySchema.default("public"),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const profile = await getCurrentProfile(ctx, ctx.userId)
    const memberships = await ctx.orm.query.member.findMany({
      where: { userId: ctx.userId },
      limit: LIMITS.ADMIN.MAX_ORGS + 1,
    })

    const maxOrgs =
      profile?.role === "system:admin"
        ? LIMITS.ADMIN.MAX_ORGS
        : LIMITS.FREE.MAX_ORGS
    if (memberships.length >= maxOrgs) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Organization limit reached",
      })
    }

    const slug = await ensureUniqueOrgSlug(ctx, input.slug ?? input.name)
    const organization = await ctx.auth.api.createOrganization({
      body: {
        logo: input.logo,
        name: input.name,
        slug,
        visibility: input.visibility,
      },
      headers: ctx.headers,
    })

    if (!organization) {
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create organization",
      })
    }

    return await withResolvedLogo(organization)
  })

export const update = authMutation
  .input(
    z.object({
      currentSlug: orgSlugSchema,
      logo: httpUrlSchema.optional(),
      name: orgNameSchema.optional(),
      updatedSlug: orgSlugWriteSchema.optional(),
      visibility: visibilitySchema.optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const access = await verifyOrgAccess(ctx, {
      slug: input.currentSlug,
      userId: ctx.userId,
    })
    if (!access.organization) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      })
    }
    if (!access.permissions.canEdit) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "User does not have permission",
      })
    }

    const nextSlug =
      input.updatedSlug && input.updatedSlug !== access.organization.slug
        ? await ensureUniqueOrgSlug(ctx, input.updatedSlug)
        : undefined

    const patch = Object.fromEntries(
      Object.entries({
        logo: input.logo,
        name: input.name,
        slug: nextSlug,
        visibility: input.visibility,
      }).filter(([, value]) => value !== undefined)
    )

    if (Object.keys(patch).length === 0) {
      return await withResolvedLogo(access.organization)
    }

    await ctx.auth.api.updateOrganization({
      body: {
        data: patch,
        organizationId: access.organization.id,
      },
      headers: ctx.headers,
    })

    const updatedOrganization = await findOrganization(ctx, {
      id: access.organization.id,
    })
    if (!updatedOrganization) {
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Organization update could not be verified",
      })
    }

    return await withResolvedLogo(updatedOrganization)
  })

export const generateAvatarUploadUrl = authMutation
  .input(
    z.object({
      organizationId: idSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const organization = await ctx.db.get(
      input.organizationId as Id<"organization">
    )
    if (!organization) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      })
    }

    const access = await verifyOrgAccess(ctx, {
      id: organization._id,
      userId: ctx.userId,
    })
    if (!access.permissions.canEdit) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message:
          "You do not have permission to upload this organization avatar",
      })
    }

    return await orgUploadsR2.generateUploadUrl(
      `ORG_AVATAR.${organization._id}`
    )
  })

export const syncAvatarMetadata = authMutation
  .input(
    z.object({
      key: storageKeySchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const organizationId = parseOrgAvatarKey(input.key)
    const organization = await ctx.db.get(organizationId)
    if (!organization) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      })
    }

    const access = await verifyOrgAccess(ctx, {
      id: organization._id,
      userId: ctx.userId,
    })
    if (!access.permissions.canEdit) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message:
          "You do not have permission to upload this organization avatar",
      })
    }

    await ctx.auth.api.updateOrganization({
      body: {
        data: { logo: input.key },
        organizationId: organization._id,
      },
      headers: ctx.headers,
    })

    await ctx.scheduler.runAfter(0, orgUploadsR2.component.lib.syncMetadata, {
      ...orgUploadsR2.config,
      key: input.key,
      onComplete: await createFunctionHandle(
        internal.org.onAvatarMetadataSynced
      ),
    })

    return null
  })

export const onAvatarMetadataSynced = internalMutation({
  args: {
    bucket: v.string(),
    isNew: v.boolean(),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const organizationId = parseOrgAvatarKey(args.key)
    const organization = await ctx.db.get(organizationId)
    if (!organization) return

    const metadata = await getOrgUploadR2Metadata(ctx as any, args.key)
    if (!metadata) return

    try {
      validateOrganizationLogoMetadata(metadata)
    } catch {
      // The presigned PUT lets the client upload arbitrary bytes, so this is the
      // server-side enforcement point. Reject invalid uploads by deleting the
      // object and clearing the (already-set) org logo so nothing bad is served.
      await orgUploadsR2.deleteObject(ctx as any, args.key)
      if (organization.logo === args.key) {
        await ctx.db.patch(organizationId, { logo: undefined })
      }
      return
    }

    await updateOrgStorageUsage(
      ctx as any,
      organization.slug,
      metadata.size ?? 0,
      args.isNew ? 1 : 0
    )
  },
})

export const getDetails = optionalAuthQuery
  .input(z.object({ slug: orgSlugSchema }))
  .query(async ({ ctx, input }) => {
    const access = await verifyOrgAccess(ctx, {
      slug: input.slug,
      userId: ctx.userId,
    })
    if (!access.organization) {
      return null
    }

    return {
      member: access.member,
      org: await withResolvedLogo(access.organization),
      permissions: access.permissions,
      userId: access.profile?.id ?? null,
    }
  })

export const getMyPermission = authQuery
  .input(z.object({ slug: orgSlugSchema }))
  .query(async ({ ctx, input }) => {
    const access = await verifyOrgAccess(ctx, {
      slug: input.slug,
      userId: ctx.userId,
    })
    if (!access.organization || !access.permissions.canCreate) {
      return { canAddProjects: false }
    }

    const projects = await ctx.orm.query.project.findMany({
      where: { orgSlug: input.slug },
      limit: LIMITS.ADMIN.MAX_PROJECTS + 1,
    })

    const maxProjects =
      access.profile?.role === "system:admin"
        ? LIMITS.ADMIN.MAX_PROJECTS
        : LIMITS.FREE.MAX_PROJECTS

    return {
      canAddProjects: projects.length < maxProjects,
    }
  })

export const findMyOrgs = authQuery.query(async ({ ctx }) => {
  const teams = await ctx.auth.api.listOrganizations({ headers: ctx.headers })

  const profile = await getCurrentProfile(ctx, ctx.userId)
  const maxOrgs =
    profile?.role === "system:admin"
      ? LIMITS.ADMIN.MAX_ORGS
      : LIMITS.FREE.MAX_ORGS

  return {
    teams: await Promise.all(teams.map((team: any) => withResolvedLogo(team))),
    underLimit: teams.length < maxOrgs,
  }
})

// Orgs where the caller can edit settings (role owner/admin/editor). Used by the
// `/org/settings` selector. `listOrganizations` doesn't expose the caller's role,
// so we read memberships directly. Security is still enforced per-org by
// `getDetails`/`verifyOrgAccess`; this is only the selector's convenience filter.
export const findMyEditableOrgs = authQuery.query(async ({ ctx }) => {
  const memberships = await ctx.orm.query.member.findMany({
    where: { userId: ctx.userId },
    limit: 200,
  })

  const editable = memberships.filter(
    (m: any) =>
      m.role === "owner" || m.role === "admin" || m.role === "editor"
  )

  const orgs = await Promise.all(
    editable.map(async (m: any) => {
      const org = await findOrganization(ctx, { id: m.organizationId })
      if (!org) return null
      const resolved = await withResolvedLogo(org)
      return {
        id: resolved.id,
        logo: resolved.logo,
        name: resolved.name,
        role: m.role as "owner" | "admin" | "editor",
        slug: resolved.slug,
      }
    })
  )

  return orgs
    .filter((o): o is NonNullable<typeof o> => o !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
})
