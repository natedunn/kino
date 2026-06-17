import { z } from "zod"
import { CRPCError } from "kitcn/server"
import { authMutation, optionalAuthQuery } from "../lib/crpc"
import {
  asId,
  getCurrentProfile,
  getCurrentProfileOrThrow,
  getDoc,
  getDocOrThrow,
  toPublicDoc,
  verifyProjectAccess,
} from "../lib/kino"
import { resolveProfileImageUrl } from "../lib/storage"
import { updateCommentTable } from "./schema"

const TEAM_ROLES = new Set(["org:admin", "org:editor"])

async function ensureUpdateCommentAccess(
  ctx: any,
  updateId: string,
  userId: string | null | undefined
) {
  const item = await getDocOrThrow(
    ctx,
    asId<"update">(updateId),
    "Update not found"
  )

  const project = await getDocOrThrow(ctx, item.projectId, "Project not found")
  const access = await verifyProjectAccess(ctx, { slug: project.slug, userId })
  if (item.status === "draft") {
    if (!access.permissions.canEdit) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "You cannot comment on draft updates",
      })
    }
  } else if (!access.permissions.canView) {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this update",
    })
  }
  return item
}

export const create = authMutation
  .input(
    z.object({
      content: z.string().min(1).max(1200),
      updateId: z.string(),
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
      _id: z.string(),
      content: z.string().min(1).max(1200),
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

    await ctx.db.delete(comment._id)
    return { deleted: true }
  })

export const listByUpdate = optionalAuthQuery
  .input(
    z.object({
      updateId: z.string(),
    })
  )
  .query(async ({ ctx, input }) => {
    const item = await getDoc(ctx, asId<"update">(input.updateId))
    if (!item) return []

    if (item.status === "draft") {
      const project = await getDoc(ctx, item.projectId)
      if (!project) return []
      const access = await verifyProjectAccess(ctx, {
        slug: project.slug,
        userId: ctx.userId,
      })
      if (!access.permissions.canEdit) return []
    }

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
          isTeamMember = !!projectMember && TEAM_ROLES.has(projectMember.role)
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
