import { z } from "zod"
import { CRPCError } from "kitcn/server"
import { authMutation, optionalAuthQuery } from "../lib/crpc"
import {
  asId,
  getCurrentProfile,
  getCurrentProfileOrThrow,
  getDoc,
  getProjectViewAccess,
  toPublicDoc,
  verifyProjectAccess,
} from "../lib/kino"
import { resolveProfileImageUrl } from "../lib/storage"
import { commentContentSchema, idSchema } from "../lib/validation"
import { feedbackCommentTable } from "./schema"

const TEAM_ROLES = new Set(["org:admin", "org:editor"])

function isMarkedForDeletion(feedback: { deletedTime?: number | null } | null) {
  return feedback?.deletedTime != null
}

async function getActiveFeedbackOrThrow(ctx: any, feedbackId: string) {
  const feedback = await getDoc(ctx, asId<"feedback">(feedbackId))
  if (!feedback || isMarkedForDeletion(feedback)) {
    throw new CRPCError({ code: "NOT_FOUND", message: "Feedback not found" })
  }
  return feedback
}

export const create = authMutation
  .input(
    z.object({
      content: commentContentSchema,
      feedbackId: idSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const profile = await getCurrentProfileOrThrow(ctx, ctx.userId)
    const feedback = await getActiveFeedbackOrThrow(ctx, input.feedbackId)
    const access = await verifyProjectAccess(ctx, {
      id: feedback.projectId,
      userId: ctx.userId,
    })
    if (!access.permissions.canView) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to this feedback",
      })
    }
    const [comment] = await ctx.orm
      .insert(feedbackCommentTable)
      .values({
        authorProfileId: profile._id as any,
        content: input.content,
        feedbackId: asId<"feedback">(input.feedbackId),
        initial: false,
      })
      .returning()
    return { commentId: comment.id }
  })

export const update = authMutation
  .input(
    z.object({
      _id: idSchema,
      content: commentContentSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const profile = await getCurrentProfileOrThrow(ctx, ctx.userId)
    const comment = await getDoc(ctx, asId<"feedbackComment">(input._id))
    if (!comment)
      throw new CRPCError({ code: "NOT_FOUND", message: "Comment not found" })
    await getActiveFeedbackOrThrow(ctx, comment.feedbackId)
    if (comment.authorProfileId !== profile._id) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "You can only edit your own comments",
      })
    }

    await ctx.db.patch(comment._id, {
      content: input.content,
      updatedTime: Date.now(),
    })
    return { updated: true }
  })

export const remove = authMutation
  .input(
    z.object({
      _id: idSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const profile = await getCurrentProfileOrThrow(ctx, ctx.userId)
    const comment = await getDoc(ctx, asId<"feedbackComment">(input._id))
    if (!comment)
      throw new CRPCError({ code: "NOT_FOUND", message: "Comment not found" })
    await getActiveFeedbackOrThrow(ctx, comment.feedbackId)
    if (comment.authorProfileId !== profile._id) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "You can only delete your own comments",
      })
    }
    if (comment.initial) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Cannot delete the initial feedback comment",
      })
    }

    await ctx.db.delete(comment._id)
    return { deleted: true }
  })

export const listByFeedback = optionalAuthQuery
  .input(
    z.object({
      feedbackId: idSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const feedback = await getDoc(ctx, asId<"feedback">(input.feedbackId))
    if (!feedback || isMarkedForDeletion(feedback)) return []

    const access = await getProjectViewAccess(ctx, {
      id: feedback.projectId,
      userId: ctx.userId,
    })
    if (!access.permissions.canView) return []

    const comments = await ctx.db
      .query("feedbackComment")
      .withIndex("by_feedbackId", (q: any) =>
        q.eq("feedbackId", asId<"feedback">(input.feedbackId))
      )
      .order("asc")
      .collect()

    const projectId = feedback?.projectId
    const currentProfile = await getCurrentProfile(ctx, ctx.userId)

    return await Promise.all(
      comments.map(async (comment: any) => {
        const author = await getDoc<"profile">(ctx, comment.authorProfileId)
        let isTeamMember = false

        if (projectId && author) {
          const projectMember = await ctx.db
            .query("projectMember")
            .withIndex("by_profileId_projectId", (q: any) =>
              q.eq("profileId", author._id).eq("projectId", projectId)
            )
            .first()
          isTeamMember = !!projectMember && TEAM_ROLES.has(projectMember.role)
        }

        const emotes = await ctx.db
          .query("feedbackCommentEmote")
          .withIndex("by_feedbackCommentId", (q: any) =>
            q.eq("feedbackCommentId", comment._id)
          )
          .collect()

        const emoteCounts: Record<
          string,
          { authorProfileIds: string[]; count: number }
        > = {}
        for (const emote of emotes) {
          if (!emoteCounts[emote.content]) {
            emoteCounts[emote.content] = { authorProfileIds: [], count: 0 }
          }
          emoteCounts[emote.content].count++
          emoteCounts[emote.content].authorProfileIds.push(
            emote.authorProfileId
          )
        }

        return {
          ...toPublicDoc(comment),
          author: author
            ? {
                id: author._id,
                imageUrl: await resolveProfileImageUrl(author),
                name: author.name,
                username: author.username,
              }
            : null,
          canDelete:
            !!currentProfile &&
            !comment.initial &&
            comment.authorProfileId === currentProfile._id,
          canEdit:
            !!currentProfile && comment.authorProfileId === currentProfile._id,
          emoteCounts,
          isTeamMember,
        }
      })
    )
  })
