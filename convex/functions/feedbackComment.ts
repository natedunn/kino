import { z } from "zod"
import { CRPCError } from "kitcn/server"
import { authMutation, optionalAuthQuery } from "../lib/crpc"
import {
  asId,
  getCurrentProfile,
  getCurrentProfileOrThrow,
  getDoc,
  toPublicDoc,
} from "../lib/kino"
import { resolveProfileImageUrl } from "../lib/storage"
import { feedbackCommentTable } from "./schema"

const TEAM_ROLES = new Set(["admin", "org:admin", "org:editor"])

export const create = authMutation
  .input(
    z.object({
      content: z.string().min(1).max(1200),
      feedbackId: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const profile = await getCurrentProfileOrThrow(ctx, ctx.userId)
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
      _id: z.string(),
      content: z.string().min(1).max(1200),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const profile = await getCurrentProfileOrThrow(ctx, ctx.userId)
    const comment = await getDoc(ctx, asId<"feedbackComment">(input._id))
    if (!comment)
      throw new CRPCError({ code: "NOT_FOUND", message: "Comment not found" })
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
      _id: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const profile = await getCurrentProfileOrThrow(ctx, ctx.userId)
    const comment = await getDoc(ctx, asId<"feedbackComment">(input._id))
    if (!comment)
      throw new CRPCError({ code: "NOT_FOUND", message: "Comment not found" })
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
      feedbackId: z.string(),
    })
  )
  .query(async ({ ctx, input }) => {
    const comments = await ctx.db
      .query("feedbackComment")
      .withIndex("by_feedbackId", (q: any) =>
        q.eq("feedbackId", asId<"feedback">(input.feedbackId))
      )
      .order("asc")
      .collect()

    const feedback = await getDoc(ctx, asId<"feedback">(input.feedbackId))
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
