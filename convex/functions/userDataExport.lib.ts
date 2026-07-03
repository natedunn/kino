import { z } from "zod"
import { CRPCError } from "kitcn/server"

import {
  getDoc,
  getProjectViewAccess,
  verifyOrgAccess,
} from "../lib/kino"
import type { Doc } from "./_generated/dataModel"
import type { QueryCtx } from "./generated/server"

export const EXPORT_FORMAT = "kino-user-data-export" as const
export const EXPORT_VERSION = 1
export const COMMENTS_SECTION_VERSION = 1
export const MAX_COMMENTS_PER_SOURCE = 750
export const MAX_EXPORT_BYTES = 900_000

export const exportSectionIds = ["comments"] as const
export const exportSectionIdSchema = z.enum(exportSectionIds)
export type ExportSectionId = (typeof exportSectionIds)[number]

export type ExportCtx = Omit<QueryCtx, "auth"> & {
  auth: unknown
  user: {
    email?: string | null
    username?: string | null
  }
  userId: string
}

export type SectionBuilder = (args: {
  ctx: ExportCtx
  profile: Doc<"profile">
}) => Promise<unknown>

export type ExportSectionDefinition = {
  id: ExportSectionId
  label: string
  description: string
  includedByDefault: boolean
  build: SectionBuilder
}

export function toExportDate(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value).toISOString() : null
}

export function toProjectSummary(project: {
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

export async function getVisibleOrganizationSummary(
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

export async function getFeedbackCommentContext(
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

export async function getUpdateCommentContext(
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

export async function buildCommentsSection({
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

export const exportSections: Record<ExportSectionId, ExportSectionDefinition> = {
  comments: {
    id: "comments",
    label: "Comments",
    description:
      "Your feedback and update comments, with the visible project context needed to understand them.",
    includedByDefault: true,
    build: buildCommentsSection,
  },
}

export function resolveRequestedSections(
  requestedSections: ExportSectionId[] | undefined
) {
  if (!requestedSections) {
    return exportSectionIds.filter(
      (sectionId) => exportSections[sectionId].includedByDefault
    )
  }

  return [...new Set(requestedSections)]
}
