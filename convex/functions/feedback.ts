import { z } from "zod"
import { eq } from "kitcn/orm"
import { CRPCError } from "kitcn/server"
import { authMutation, optionalAuthQuery } from "../lib/crpc"
import {
  asId,
  generateRandomSlug,
  getCurrentProfile,
  getCurrentProfileOrThrow,
  getDoc,
  getDocOrThrow,
  toPublicDoc,
  verifyProjectAccess,
} from "../lib/kino"
import { resolveProfileImageUrl } from "../lib/storage"
import { recordFeedbackEvent } from "./feedbackEvent"
import { feedbackCommentTable, feedbackTable } from "./schema"

const feedbackStatusSchema = z.enum([
  "open",
  "in-progress",
  "closed",
  "completed",
  "paused",
])
const EDIT_ROLES = new Set(["admin", "org:admin", "org:editor"])

function hasOverlap(left: string[], right: string[]) {
  return left.some((value) => right.includes(value))
}

export const create = authMutation
  .input(
    z.object({
      boardId: z.string(),
      firstComment: z.string().min(1).max(1200),
      projectId: z.string(),
      title: z.string().min(1).max(100),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const profile = await getCurrentProfileOrThrow(ctx, ctx.userId)
    const slug = generateRandomSlug()

    const [feedback] = await ctx.orm
      .insert(feedbackTable)
      .values({
        authorProfileId: profile._id as any,
        boardId: asId<"feedbackBoard">(input.boardId),
        projectId: asId<"project">(input.projectId),
        slug,
        status: "open",
        title: input.title,
        upvotes: 0,
      })
      .returning()

    const [feedbackComment] = await ctx.orm
      .insert(feedbackCommentTable)
      .values({
        authorProfileId: profile._id as any,
        content: input.firstComment,
        feedbackId: feedback.id as any,
        initial: true,
      })
      .returning()

    await ctx.orm
      .update(feedbackTable)
      .set({
        firstCommentId: feedbackComment.id as any,
        searchContent: `${input.title} ${input.firstComment}`,
      })
      .where(eq(feedbackTable.id, feedback.id))

    return {
      feedbackCommentId: feedbackComment.id,
      feedbackId: feedback.id,
      slug,
    }
  })

async function verifyFeedbackWriteAccess(
  ctx: any,
  feedbackId: string,
  userId: string
) {
  const profile = await getCurrentProfileOrThrow(ctx, userId)
  const feedback = await getDocOrThrow(
    ctx,
    asId<"feedback">(feedbackId),
    "Feedback not found"
  )
  const project = await getDocOrThrow(
    ctx,
    feedback.projectId,
    "Project not found"
  )
  const access = await verifyProjectAccess(ctx, { slug: project.slug, userId })
  return {
    feedback,
    isOwner: feedback.authorProfileId === profile._id,
    profile,
    project,
    projectMember: access.projectMember,
    permissions: access.permissions,
  }
}

export const updateStatus = authMutation
  .input(
    z.object({
      id: z.string(),
      status: feedbackStatusSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { feedback, isOwner, permissions, profile } =
      await verifyFeedbackWriteAccess(ctx, input.id, ctx.userId)
    if (!isOwner && !permissions.canEdit) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to update this feedback status",
      })
    }

    await ctx.orm
      .update(feedbackTable)
      .set({ status: input.status, updatedTime: Date.now() })
      .where(eq(feedbackTable.id, feedback._id as any))
    if (feedback.status !== input.status) {
      await recordFeedbackEvent(ctx, {
        actorProfileId: profile._id,
        eventType: "status_changed",
        feedbackId: feedback._id,
        metadata: { oldValue: feedback.status, newValue: input.status },
      })
    }
    return { success: true }
  })

export const updateBoard = authMutation
  .input(
    z.object({
      id: z.string(),
      boardId: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { feedback, isOwner, permissions, profile } =
      await verifyFeedbackWriteAccess(ctx, input.id, ctx.userId)
    if (!isOwner && !permissions.canEdit) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to update this feedback board",
      })
    }

    const newBoard = await getDoc(ctx, asId<"feedbackBoard">(input.boardId))
    if (!newBoard || newBoard.projectId !== feedback.projectId) {
      throw new CRPCError({ code: "BAD_REQUEST", message: "Invalid board" })
    }
    const oldBoard = await getDoc(ctx, feedback.boardId)
    await ctx.orm
      .update(feedbackTable)
      .set({
        boardId: asId<"feedbackBoard">(input.boardId),
        updatedTime: Date.now(),
      })
      .where(eq(feedbackTable.id, feedback._id as any))

    if (feedback.boardId !== input.boardId) {
      await recordFeedbackEvent(ctx, {
        actorProfileId: profile._id,
        eventType: "board_changed",
        feedbackId: feedback._id,
        metadata: {
          oldValue: oldBoard?.name ?? "Unknown",
          newValue: newBoard.name,
        },
      })
    }
    return { success: true }
  })

export const setAnswerComment = authMutation
  .input(
    z.object({
      commentId: z.string().nullable(),
      feedbackId: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { feedback, isOwner, profile, projectMember } =
      await verifyFeedbackWriteAccess(ctx, input.feedbackId, ctx.userId)
    const canMarkAnswer =
      isOwner ||
      profile.role === "system:admin" ||
      projectMember?.role === "org:admin"
    if (!canMarkAnswer) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to mark a comment as answer",
      })
    }

    if (input.commentId === null) {
      await ctx.db.patch(feedback._id, {
        answerCommentId: undefined,
        updatedTime: Date.now(),
      })
      if (feedback.answerCommentId) {
        await recordFeedbackEvent(ctx, {
          actorProfileId: profile._id,
          eventType: "answer_unmarked",
          feedbackId: feedback._id,
        })
      }
      return { success: true }
    }

    const comment = await getDoc(ctx, asId<"feedbackComment">(input.commentId))
    if (!comment || comment.feedbackId !== asId<"feedback">(input.feedbackId)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Comment not found or does not belong to this feedback",
      })
    }
    if (comment.initial) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Cannot mark the initial comment as the answer",
      })
    }

    await ctx.db.patch(feedback._id, {
      answerCommentId: input.commentId as any,
      updatedTime: Date.now(),
    })
    await recordFeedbackEvent(ctx, {
      actorProfileId: profile._id,
      eventType: "answer_marked",
      feedbackId: feedback._id,
    })
    return { success: true }
  })

export const updateAssigned = authMutation
  .input(
    z.object({
      assignedProfileId: z.string().nullable(),
      feedbackId: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { feedback, permissions, profile } = await verifyFeedbackWriteAccess(
      ctx,
      input.feedbackId,
      ctx.userId
    )
    if (!permissions.canEdit) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to assign feedback",
      })
    }

    if (input.assignedProfileId !== null) {
      const assignedProfileId = asId<"profile">(input.assignedProfileId)
      const assigneeProjectMember = await ctx.db
        .query("projectMember")
        .withIndex("by_profileId_projectId", (q: any) =>
          q
            .eq("profileId", assignedProfileId)
            .eq("projectId", feedback.projectId)
        )
        .unique()

      if (!assigneeProjectMember) {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: "Assignee must be a project member",
        })
      }
      if (!EDIT_ROLES.has(assigneeProjectMember.role)) {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: "Assignee must have edit permissions",
        })
      }
    }

    const oldAssignedProfileId = feedback.assignedProfileId
    await ctx.orm
      .update(feedbackTable)
      .set({
        assignedProfileId: input.assignedProfileId
          ? asId<"profile">(input.assignedProfileId)
          : null,
        updatedTime: Date.now(),
      })
      .where(eq(feedbackTable.id, feedback._id as any))

    if (input.assignedProfileId === null && oldAssignedProfileId) {
      await recordFeedbackEvent(ctx, {
        actorProfileId: profile._id,
        eventType: "unassigned",
        feedbackId: feedback._id,
        metadata: { targetProfileId: oldAssignedProfileId },
      })
    } else if (
      input.assignedProfileId &&
      input.assignedProfileId !== oldAssignedProfileId
    ) {
      await recordFeedbackEvent(ctx, {
        actorProfileId: profile._id,
        eventType: "assigned",
        feedbackId: feedback._id,
        metadata: { targetProfileId: input.assignedProfileId },
      })
    }

    return { success: true }
  })

export const getBySlug = optionalAuthQuery
  .input(
    z.object({
      projectId: z.string(),
      slug: z.string(),
    })
  )
  .query(async ({ ctx, input }) => {
    const feedback = await ctx.db
      .query("feedback")
      .withIndex("by_projectId_slug", (q: any) =>
        q.eq("projectId", input.projectId).eq("slug", input.slug)
      )
      .first()
    if (!feedback) return null

    const author = await getDoc(ctx, feedback.authorProfileId)
    const board = await getDoc(ctx, feedback.boardId)
    const firstComment = await getDoc(ctx, feedback.firstCommentId)
    const assignedProfile = await getDoc(ctx, feedback.assignedProfileId)

    const currentProfile = await getCurrentProfile(ctx, ctx.userId)
    let hasUpvoted = false
    if (currentProfile) {
      const existing = await ctx.db
        .query("feedbackUpvote")
        .withIndex("by_feedbackId_authorProfileId", (q: any) =>
          q
            .eq("feedbackId", feedback._id)
            .eq("authorProfileId", currentProfile._id)
        )
        .unique()
      hasUpvoted = !!existing
    }

    return {
      feedback: toPublicDoc(feedback),
      hasUpvoted,
      author: author
        ? {
            id: author._id,
            imageUrl: await resolveProfileImageUrl(author),
            name: author.name,
            username: author.username,
          }
        : null,
      assignedProfile: assignedProfile
        ? {
            id: assignedProfile._id,
            imageUrl: await resolveProfileImageUrl(assignedProfile),
            name: assignedProfile.name,
            username: assignedProfile.username,
          }
        : null,
      board: board
        ? {
            id: board._id,
            icon: board.icon,
            name: board.name,
            slug: board.slug,
          }
        : null,
      firstComment: firstComment
        ? {
            ...toPublicDoc(firstComment),
            authorProfileId: firstComment.authorProfileId,
            content: firstComment.content,
            updatedTime: firstComment.updatedTime,
          }
        : null,
    }
  })

export const listProjectFeedback = optionalAuthQuery
  .input(
    z.object({
      boardId: z.string().or(z.literal("all")),
      order: z.enum(["asc", "desc"]).optional(),
      projectId: z.string(),
      search: z.string().optional(),
      status: feedbackStatusSchema.optional(),
      tags: z.array(z.string()).optional(),
    })
  )
  .paginated({ limit: 50, item: z.any() })
  .query(async ({ ctx, input }) => {
    let query: any

    if (input.search?.trim()) {
      query = ctx.db
        .query("feedback")
        .withSearchIndex(
          "by_projectId_boardId_status_searchContent",
          (builder: any) => {
            let next = builder
              .search("searchContent", input.search)
              .eq("projectId", asId<"project">(input.projectId))
            if (input.boardId !== "all")
              next = next.eq("boardId", asId<"feedbackBoard">(input.boardId))
            if (input.status) next = next.eq("status", input.status)
            return next
          }
        )
    } else if (input.boardId !== "all" && input.status) {
      query = ctx.db
        .query("feedback")
        .withIndex("by_projectId_boardId_status", (q: any) =>
          q
            .eq("projectId", asId<"project">(input.projectId))
            .eq("boardId", asId<"feedbackBoard">(input.boardId))
            .eq("status", input.status)
        )
        .order(input.order ?? "desc")
    } else if (input.boardId !== "all") {
      query = ctx.db
        .query("feedback")
        .withIndex("by_projectId_boardId", (q: any) =>
          q
            .eq("projectId", asId<"project">(input.projectId))
            .eq("boardId", asId<"feedbackBoard">(input.boardId))
        )
        .order(input.order ?? "desc")
    } else if (input.status) {
      query = ctx.db
        .query("feedback")
        .withIndex("by_projectId_status", (q: any) =>
          q.eq("projectId", asId<"project">(input.projectId)).eq("status", input.status)
        )
        .order(input.order ?? "desc")
    } else {
      query = ctx.db
        .query("feedback")
        .withIndex("by_projectId", (q: any) =>
          q.eq("projectId", asId<"project">(input.projectId))
        )
        .order(input.order ?? "desc")
    }

    const result = await query.paginate({
      cursor: input.cursor,
      numItems: input.limit,
    })
    const page = input.tags?.length
      ? result.page.filter((row: any) =>
          row?.tags ? hasOverlap(row.tags, input.tags ?? []) : false
        )
      : result.page

    const currentProfile = await getCurrentProfile(ctx, ctx.userId)

    return {
      continueCursor: result.continueCursor,
      isDone: result.isDone,
      page: await Promise.all(
        page.map(async (item: any) => {
          const board = await getDoc<"feedbackBoard">(ctx, item.boardId)
          const firstComment = await getDoc<"feedbackComment">(
            ctx,
            item.firstCommentId
          )
          let hasUpvoted = false
          if (currentProfile) {
            const existing = await ctx.db
              .query("feedbackUpvote")
              .withIndex("by_feedbackId_authorProfileId", (q: any) =>
                q
                  .eq("feedbackId", item._id)
                  .eq("authorProfileId", currentProfile._id)
              )
              .unique()
            hasUpvoted = !!existing
          }
          return {
            ...toPublicDoc(item),
            board: board ? { id: board._id, name: board.name } : null,
            firstComment: firstComment ? toPublicDoc(firstComment) : null,
            hasUpvoted,
          }
        })
      ),
    }
  })

export const searchForLinking = optionalAuthQuery
  .input(
    z.object({
      projectId: z.string(),
      search: z.string(),
    })
  )
  .query(async ({ ctx, input }) => {
    const feedback = input.search.trim()
      ? await ctx.db
          .query("feedback")
          .withSearchIndex(
            "by_projectId_boardId_status_searchContent",
            (q: any) =>
              q
                .search("searchContent", input.search)
                .eq("projectId", input.projectId)
          )
          .take(20)
      : await ctx.db
          .query("feedback")
          .withIndex("by_projectId", (q: any) =>
            q.eq("projectId", input.projectId)
          )
          .order("desc")
          .take(20)

    return await Promise.all(
      feedback.map(async (item: any) => {
        const board = await getDoc<"feedbackBoard">(ctx, item.boardId)
        return {
          id: item._id,
          board: board ? { id: board._id, name: board.name } : null,
          slug: item.slug,
          status: item.status,
          title: item.title,
        }
      })
    )
  })

export const getByIds = optionalAuthQuery
  .input(
    z.object({
      ids: z.array(z.string()),
    })
  )
  .query(async ({ ctx, input }) => {
    const rows = await Promise.all(
      input.ids.map(async (id) => {
        const item = await getDoc(ctx, asId<"feedback">(id))
        if (!item) return null
        const board = await getDoc<"feedbackBoard">(ctx, item.boardId)
        return {
          id: item._id,
          board: board ? { id: board._id, name: board.name } : null,
          slug: item.slug,
          status: item.status,
          title: item.title,
        }
      })
    )
    return rows.filter(
      (item): item is NonNullable<typeof item> => item !== null
    )
  })
