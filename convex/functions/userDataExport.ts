import { z } from "zod"
import { CRPCError } from "kitcn/server"

import { authQuery } from "../lib/crpc"
import {
  getCurrentProfileOrThrow,
  getDoc,
  getProjectViewAccess,
  verifyOrgAccess,
} from "../lib/kino"
import type { Doc } from "./_generated/dataModel"
import type { QueryCtx } from "./generated/server"

const EXPORT_FORMAT = "kino-user-data-export" as const
const EXPORT_VERSION = 1
const COMMENTS_SECTION_VERSION = 1
const MAX_COMMENTS_PER_SOURCE = 750
const MAX_EXPORT_BYTES = 900_000

const exportSectionIds = ["comments"] as const
const exportSectionIdSchema = z.enum(exportSectionIds)
type ExportSectionId = (typeof exportSectionIds)[number]

type ExportCtx = Omit<QueryCtx, "auth"> & {
  auth: unknown
  user: {
    email?: string | null
    username?: string | null
  }
  userId: string
}

type SectionBuilder = (args: {
  ctx: ExportCtx
  profile: Doc<"profile">
}) => Promise<unknown>

type ExportSectionDefinition = {
  id: ExportSectionId
  label: string
  description: string
  includedByDefault: boolean
  build: SectionBuilder
}

function toExportDate(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value).toISOString() : null
}

function toProjectSummary(project: {
  id?: string
  _id?: string
  name: string
  orgSlug: string
  slug: string
  visibility: string
}) {
  return {
    id: project.id ?? project._id ?? "",
    name: project.name,
    orgSlug: project.orgSlug,
    slug: project.slug,
    visibility: project.visibility,
  }
}

async function getVisibleOrganizationSummary(
  ctx: ExportCtx,
  args: { orgSlug: string }
) {
  const organization = await ctx.db
    .query("organization")
    .withIndex("slug", (q: any) => q.eq("slug", args.orgSlug))
    .first()

  if (!organization) return null

  const access = await verifyOrgAccess(ctx, {
    id: organization._id,
    userId: ctx.userId,
  })
  if (!access.permissions.canView) return null

  return {
    id: organization._id,
    name: organization.name,
    slug: organization.slug,
  }
}

async function getFeedbackCommentContext(
  ctx: ExportCtx,
  comment: Doc<"feedbackComment">
) {
  const feedback = await getDoc<"feedback">(ctx, comment.feedbackId)
  if (!feedback) {
    return {
      contextAccess: "missing" as const,
      feedbackId: comment.feedbackId,
    }
  }

  const access = await getProjectViewAccess(ctx, {
    id: feedback.projectId,
    userId: ctx.userId,
  })
  if (!access.permissions.canView || !access.project) {
    return {
      contextAccess: "inaccessible" as const,
      feedbackId: feedback._id,
      projectId: feedback.projectId,
    }
  }

  const [board, organization] = await Promise.all([
    getDoc<"feedbackBoard">(ctx, feedback.boardId),
    getVisibleOrganizationSummary(ctx, { orgSlug: access.project.orgSlug }),
  ])

  return {
    contextAccess: "visible" as const,
    board: board
      ? {
          id: board._id,
          name: board.name,
          slug: board.slug,
        }
      : null,
    feedback: {
      id: feedback._id,
      slug: feedback.slug,
      status: feedback.status,
      title: feedback.title,
    },
    organization,
    project: toProjectSummary(access.project),
  }
}

async function getUpdateCommentContext(
  ctx: ExportCtx,
  comment: Doc<"updateComment">
) {
  const update = await getDoc<"update">(ctx, comment.updateId)
  if (!update) {
    return {
      contextAccess: "missing" as const,
      updateId: comment.updateId,
    }
  }

  const access = await getProjectViewAccess(ctx, {
    id: update.projectId,
    userId: ctx.userId,
  })
  if (
    !access.permissions.canView ||
    !access.project ||
    (update.status === "draft" && !access.permissions.canEdit)
  ) {
    return {
      contextAccess: "inaccessible" as const,
      projectId: update.projectId,
      updateId: update._id,
    }
  }

  const organization = await getVisibleOrganizationSummary(ctx, {
    orgSlug: access.project.orgSlug,
  })

  return {
    contextAccess: "visible" as const,
    organization,
    project: toProjectSummary(access.project),
    update: {
      category: update.category,
      id: update._id,
      publishedAt: toExportDate(update.publishedAt),
      slug: update.slug,
      status: update.status,
      title: update.title,
    },
  }
}

async function buildCommentsSection({
  ctx,
  profile,
}: {
  ctx: ExportCtx
  profile: Doc<"profile">
}) {
  const [feedbackComments, updateComments] = await Promise.all([
    ctx.db
      .query("feedbackComment")
      .withIndex("by_authorProfileId", (q: any) =>
        q.eq("authorProfileId", profile._id)
      )
      .order("asc")
      .take(MAX_COMMENTS_PER_SOURCE + 1),
    ctx.db
      .query("updateComment")
      .withIndex("by_authorProfileId", (q: any) =>
        q.eq("authorProfileId", profile._id)
      )
      .order("asc")
      .take(MAX_COMMENTS_PER_SOURCE + 1),
  ])

  if (
    feedbackComments.length > MAX_COMMENTS_PER_SOURCE ||
    updateComments.length > MAX_COMMENTS_PER_SOURCE
  ) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message:
        "Your comments export is too large for immediate download. Try again after async exports are available.",
    })
  }

  return {
    version: COMMENTS_SECTION_VERSION,
    counts: {
      feedbackComments: feedbackComments.length,
      updateComments: updateComments.length,
      total: feedbackComments.length + updateComments.length,
    },
    feedbackComments: await Promise.all(
      feedbackComments.map(async (comment) => ({
        id: comment._id,
        content: comment.content,
        createdAt: toExportDate(comment._creationTime),
        updatedAt: toExportDate(comment.updatedTime),
        feedbackId: comment.feedbackId,
        initial: comment.initial ?? false,
        replyFeedbackCommentId: comment.replyFeedbackCommentId ?? null,
        source: "feedback" as const,
        context: await getFeedbackCommentContext(ctx, comment),
      }))
    ),
    updateComments: await Promise.all(
      updateComments.map(async (comment) => ({
        id: comment._id,
        content: comment.content,
        createdAt: toExportDate(comment._creationTime),
        updatedAt: toExportDate(comment.updatedTime),
        updateId: comment.updateId,
        source: "update" as const,
        context: await getUpdateCommentContext(ctx, comment),
      }))
    ),
  }
}

const exportSections: Record<ExportSectionId, ExportSectionDefinition> = {
  comments: {
    id: "comments",
    label: "Comments",
    description:
      "Your feedback and update comments, with the visible project context needed to understand them.",
    includedByDefault: true,
    build: buildCommentsSection,
  },
}

function resolveRequestedSections(
  requestedSections: ExportSectionId[] | undefined
) {
  if (!requestedSections) {
    return exportSectionIds.filter(
      (sectionId) => exportSections[sectionId].includedByDefault
    )
  }

  return [...new Set(requestedSections)]
}

export const getAvailableSections = authQuery
  .input(z.object({}))
  .query(async () =>
    exportSectionIds.map((sectionId) => {
      const section = exportSections[sectionId]
      return {
        id: section.id,
        label: section.label,
        description: section.description,
        includedByDefault: section.includedByDefault,
      }
    })
  )

export const exportData = authQuery
  .input(
    z.object({
      sections: z.array(exportSectionIdSchema).optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    const exportCtx = ctx as ExportCtx
    const profile = await getCurrentProfileOrThrow(exportCtx, exportCtx.userId)
    const requestedSections = resolveRequestedSections(input.sections)
    const sections: Partial<Record<ExportSectionId, unknown>> = {}

    for (const sectionId of requestedSections) {
      sections[sectionId] = await exportSections[sectionId].build({
        ctx: exportCtx,
        profile,
      })
    }

    const exportDocument = {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      generatedAt: new Date().toISOString(),
      account: {
        userId: exportCtx.userId,
        profileId: profile._id,
        username: profile.username,
        email: profile.email ?? exportCtx.user.email ?? null,
      },
      sections,
    }

    if (
      new TextEncoder().encode(JSON.stringify(exportDocument)).length >
      MAX_EXPORT_BYTES
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message:
          "Your export is too large for immediate download. Try again after async exports are available.",
      })
    }

    return exportDocument
  })
