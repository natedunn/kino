import { z } from "zod"
import { eq } from "kitcn/orm"
import { CRPCError } from "kitcn/server"
import { authMutation, optionalAuthQuery } from "../lib/crpc"
import {
  asId,
  getCurrentProfile,
  getCurrentProfileOrThrow,
  getDoc,
  getDocOrThrow,
  isProjectEditorRole,
  toPublicDoc,
  verifyProjectAccess,
} from "../lib/kino"
import { resolveProfileImageUrl } from "../lib/storage"
import { commentContentSchema, idSchema } from "../lib/validation"
import { updateCommentTable } from "./schema"
import { ensureUpdateCommentAccess } from "./updateComment.lib"

export const create = authMutation
  .input(
    z.object({
      content: commentContentSchema,
      updateId: idSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const profile = await getCurrentProfileOrThrow(ctx, ctx.userId)
    const item = await ensureUpdateCommentAccess(
      ctx,
      input.updateId,
      ctx.userId
    )
    const [comment] = await ctx.orm
      .insert(updateCommentTable)
      .values({
        authorProfileId: profile._id as any,
        content: input.content,
        updateId: item._id as any,
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
    const comment = await getDocOrThrow(
      ctx,
      asId<"updateComment">(input._id),
      "Comment not found"
    )
    if (comment.authorProfileId !== profile._id) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "You can only edit your own comments",
      })
    }

    await ctx.orm
      .update(updateCommentTable)
      .set({
        content: input.content,
        updatedTime: Date.now(),
      })
      .where(eq(updateCommentTable.id, comment._id))
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
    const comment = await getDocOrThrow(
      ctx,
      asId<"updateComment">(input._id),
      "Comment not found"
    )
    if (comment.authorProfileId !== profile._id) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "You can only delete your own comments",
      })
    }

    // ORM delete so the comment's emotes cascade away via FK referential
    // actions.
    await ctx.orm
      .delete(updateCommentTable)
      .where(eq(updateCommentTable.id, comment._id))
    return { deleted: true }
  })

export const listByUpdate = optionalAuthQuery
  .input(
    z.object({
      updateId: idSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const item = await getDoc(ctx, asId<"update">(input.updateId))
    if (!item) return []

    const project = await getDoc(ctx, item.projectId)
    if (!project) return []
    const access = await verifyProjectAccess(ctx, {
      slug: project.slug,
      userId: ctx.userId,
    })
    if (!access.permissions.canView) return []
    if (item.status === "draft" && !access.permissions.canEdit) return []

    const currentProfile = await getCurrentProfile(ctx, ctx.userId)
    const comments = await ctx.db
      .query("updateComment")
      .withIndex("by_updateId", (q: any) => q.eq("updateId", item._id))
      .order("asc")
      .collect()

    return await Promise.all(
      comments.map(async (comment) => {
        const author = await getDoc<"profile">(ctx, comment.authorProfileId)
        let isTeamMember = false

        if (author) {
          const projectMember = await ctx.db
            .query("projectMember")
            .withIndex("by_profileId_projectId", (q: any) =>
              q.eq("profileId", author._id).eq("projectId", item.projectId)
            )
            .first()
          isTeamMember =
            !!projectMember && isProjectEditorRole(projectMember.role)
        }

        const emotes = await ctx.db
          .query("updateCommentEmote")
          .withIndex("by_updateCommentId", (q: any) =>
            q.eq("updateCommentId", comment._id)
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
            !!currentProfile && comment.authorProfileId === currentProfile._id,
          canEdit:
            !!currentProfile && comment.authorProfileId === currentProfile._id,
          emoteCounts,
          isTeamMember,
        }
      })
    )
  })
