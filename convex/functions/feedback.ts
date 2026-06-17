import { z } from "zod"
import { eq } from "kitcn/orm"
import { CRPCError } from "kitcn/server"
import {
  isValidTarget,
  resolveTargetOrNull,
  targetGranularities,
} from "../shared/target"

import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import { authMutation, authQuery, optionalAuthQuery } from "../lib/crpc"
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

const FEEDBACK_DELETION_DELAY_MS = 1000 * 60 * 60 * 48
const feedbackStatusSchema = z.enum([
  "open",
  "in-progress",
  "closed",
  "completed",
  "paused",
])
const targetGranularitySchema = z.enum(targetGranularities)
const EDIT_ROLES = new Set(["admin", "editor", "org:admin", "org:editor"])

function hasOverlap(left: Array<string>, right: Array<string>) {
  return left.some((value) => right.includes(value))
}

function isMarkedForDeletion(feedback: { deletedTime?: number | null }) {
  return feedback.deletedTime != null
}

function assertFeedbackActive(feedback: { deletedTime?: number | null }) {
  if (isMarkedForDeletion(feedback)) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Feedback not found",
    })
  }
}

function assertCanAdminFeedback(permissions: { canEdit: boolean }) {
  if (!permissions.canEdit) {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to manage this feedback",
    })
  }
}

function toPublicFeedbackDoc(feedback: Doc<"feedback">) {
  return {
    ...toPublicDoc(feedback),
    targetRange: resolveTargetOrNull(
      feedback.target,
      feedback.targetGranularity
    ),
  }
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
  assertFeedbackActive(feedback)
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

export const markForDeletion = authMutation
  .input(
    z.object({
      id: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { feedback, permissions } = await verifyFeedbackWriteAccess(
      ctx,
      input.id,
      ctx.userId
    )
    assertCanAdminFeedback(permissions)

    const deletedTime = Date.now() + FEEDBACK_DELETION_DELAY_MS
    await ctx.db.patch(feedback._id, {
      deletionScheduled: true,
      deletedTime,
      updatedTime: Date.now(),
    })
    await ctx.scheduler.runAt(deletedTime, internal.crons.purgeDueFeedback, {})

    return { deletedTime }
  })

export const unmarkForDeletion = authMutation
  .input(
    z.object({
      id: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const feedback = await getDocOrThrow(
      ctx,
      asId<"feedback">(input.id),
      "Feedback not found"
    )
    const project = await getDocOrThrow(
      ctx,
      feedback.projectId,
      "Project not found"
    )
    const access = await verifyProjectAccess(ctx, {
      slug: project.slug,
      userId: ctx.userId,
    })
    assertCanAdminFeedback(access.permissions)

    if (!isMarkedForDeletion(feedback)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Feedback is not marked for deletion",
      })
    }
    const deletedTime = feedback.deletedTime
    if (deletedTime == null || deletedTime <= Date.now()) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Feedback deletion can no longer be restored",
      })
    }

    await ctx.db.patch(feedback._id, {
      deletionScheduled: false,
      deletedTime: null,
      updatedTime: Date.now(),
    })

    return {
      restored: true,
    }
  })

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

export const updateTitle = authMutation
  .input(
    z.object({
      id: z.string(),
      title: z.string().trim().min(1).max(100),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { feedback, isOwner, permissions, profile } =
      await verifyFeedbackWriteAccess(ctx, input.id, ctx.userId)
    if (!isOwner && !permissions.canEdit) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to update this feedback title",
      })
    }

    if (feedback.title === input.title) {
      return { success: true }
    }

    const firstComment = await getDoc(ctx, feedback.firstCommentId)
    await ctx.orm
      .update(feedbackTable)
      .set({
        searchContent: `${input.title} ${firstComment?.content ?? ""}`.trim(),
        title: input.title,
        updatedTime: Date.now(),
      })
      .where(eq(feedbackTable.id, feedback._id as any))

    await recordFeedbackEvent(ctx, {
      actorProfileId: profile._id,
      eventType: "title_changed",
      feedbackId: feedback._id,
      metadata: { oldValue: feedback.title, newValue: input.title },
    })

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

export const updateTarget = authMutation
  .input(
    z.object({
      feedbackId: z.string(),
      target: z.string().trim().nullable(),
      targetGranularity: targetGranularitySchema.nullable(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { feedback, permissions } = await verifyFeedbackWriteAccess(
      ctx,
      input.feedbackId,
      ctx.userId
    )
    if (!permissions.canEdit) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to update this feedback target",
      })
    }

    const target = input.target
    const targetGranularity = input.targetGranularity
    const hasTarget = target !== null && target.length > 0
    const hasGranularity = targetGranularity !== null
    if (hasTarget !== hasGranularity) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Target and granularity must be provided together",
      })
    }

    if (!hasTarget || !target || !targetGranularity) {
      await ctx.orm
        .update(feedbackTable)
        .set({
          target: null,
          targetGranularity: null,
          updatedTime: Date.now(),
        })
        .where(eq(feedbackTable.id, feedback._id as any))
      return { success: true }
    }

    if (!isValidTarget(target, targetGranularity)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Target does not match the selected granularity",
      })
    }

    await ctx.orm
      .update(feedbackTable)
      .set({
        target,
        targetGranularity,
        updatedTime: Date.now(),
      })
      .where(eq(feedbackTable.id, feedback._id as any))

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
        q.eq("projectId", asId<"project">(input.projectId)).eq("slug", input.slug)
      )
      .first()
    if (!feedback || isMarkedForDeletion(feedback)) return null

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
      feedback: toPublicFeedbackDoc(feedback),
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
          q
            .eq("projectId", asId<"project">(input.projectId))
            .eq("status", input.status)
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
    const activePage = result.page.filter((row: any) => !isMarkedForDeletion(row))
    const page = input.tags?.length
      ? activePage.filter((row: any) =>
          row?.tags ? hasOverlap(row.tags, input.tags ?? []) : false
        )
      : activePage

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
            ...toPublicFeedbackDoc(item),
            board: board ? { id: board._id, name: board.name } : null,
            firstComment: firstComment ? toPublicDoc(firstComment) : null,
            hasUpvoted,
          }
        })
      ),
    }
  })

export const listPendingDeletion = authQuery
  .input(
    z.object({
      projectId: z.string(),
    })
  )
  .paginated({ limit: 50, item: z.any() })
  .query(async ({ ctx, input }) => {
    const access = await verifyProjectAccess(ctx, {
      id: input.projectId,
      userId: ctx.userId,
    })
    assertCanAdminFeedback(access.permissions)

    const result = await ctx.db
      .query("feedback")
      .withIndex("by_projectId_deletedTime", (q: any) =>
        q
          .eq("projectId", asId<"project">(input.projectId))
          .gt("deletedTime", Date.now())
      )
      .order("desc")
      .paginate({
        cursor: input.cursor,
        numItems: input.limit,
      })

    return {
      continueCursor: result.continueCursor,
      isDone: result.isDone,
      page: await Promise.all(
        result.page.map(async (item: any) => {
          const board = await getDoc<"feedbackBoard">(ctx, item.boardId)
          const firstComment = await getDoc<"feedbackComment">(
            ctx,
            item.firstCommentId
          )
          return {
            ...toPublicFeedbackDoc(item),
            board: board ? { id: board._id, name: board.name } : null,
            firstComment: firstComment ? toPublicDoc(firstComment) : null,
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
                .eq("projectId", asId<"project">(input.projectId))
          )
          .take(50)
      : await ctx.db
          .query("feedback")
          .withIndex("by_projectId", (q: any) =>
            q.eq("projectId", asId<"project">(input.projectId))
          )
          .order("desc")
          .take(50)

    return await Promise.all(
      feedback.filter((item: any) => !isMarkedForDeletion(item)).slice(0, 20).map(async (item: any) => {
        const board = await getDoc<"feedbackBoard">(ctx, item.boardId)
        return {
          id: item._id,
          board: board ? { id: board._id, name: board.name } : null,
          slug: item.slug,
          status: item.status,
          target: item.target ?? null,
          targetGranularity: item.targetGranularity ?? null,
          targetRange: resolveTargetOrNull(item.target, item.targetGranularity),
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
        if (!item || isMarkedForDeletion(item)) return null
        const board = await getDoc<"feedbackBoard">(ctx, item.boardId)
        return {
          id: item._id,
          board: board ? { id: board._id, name: board.name } : null,
          slug: item.slug,
          status: item.status,
          target: item.target ?? null,
          targetGranularity: item.targetGranularity ?? null,
          targetRange: resolveTargetOrNull(item.target, item.targetGranularity),
          title: item.title,
        }
      })
    )
    return rows.filter(
      (item): item is NonNullable<typeof item> => item !== null
    )
  })
