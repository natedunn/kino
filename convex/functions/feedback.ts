import { z } from "zod"
import { eq, unsetToken } from "kitcn/orm"
import { CRPCError } from "kitcn/server"
import { isValidTarget, resolveTargetOrNull } from "../shared/target"

import type { Doc } from "./_generated/dataModel"
import { authMutation, optionalAuthQuery } from "../lib/crpc"
import {
  asId,
  generateRandomSlug,
  getCurrentProfile,
  getCurrentProfileOrThrow,
  getDoc,
  getProjectViewAccess,
  isProjectEditorRole,
  toPublicDoc,
  verifyProjectAccess,
} from "../lib/kino"
import {
  commentContentSchema,
  feedbackSearchSchema,
  feedbackTitleSchema,
  generatedSlugSchema,
  idArraySchema,
  idSchema,
  nullableIdSchema,
  tagListSchema,
  targetSchema,
} from "../lib/validation"
import { recordFeedbackEvent } from "./feedbackEvent.lib"
import { feedbackCommentTable, feedbackTable } from "./schema"
import {
  assertCanAdminFeedback,
  createCommentEnrichCache,
  dedupeComments,
  dedupeDocsById,
  feedbackStatusSchema,
  getFeedbackCommentWindow,
  hasOverlap,
  MIDDLE_COMMENT_PAGE_SIZE,
  targetGranularitySchema,
  toProfileSummary,
  toPublicFeedbackComment,
  toPublicFeedbackDoc,
  verifyFeedbackWriteAccess,
} from "./feedback.lib"

export const create = authMutation
  .input(
    z.object({
      boardId: idSchema,
      firstComment: commentContentSchema,
      projectId: idSchema,
      title: feedbackTitleSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const profile = await getCurrentProfileOrThrow(ctx, ctx.userId)

    // Authorize: caller must be able to view the target project, and the board
    // must belong to that project (never trust the client-supplied ids alone).
    const access = await verifyProjectAccess(ctx, {
      id: input.projectId,
      userId: ctx.userId,
    })
    if (!access.permissions.canView) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to this project",
      })
    }
    const board = await getDoc<"feedbackBoard">(
      ctx,
      asId<"feedbackBoard">(input.boardId)
    )
    if (!board || board.projectId !== asId<"project">(input.projectId)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Invalid board for this project",
      })
    }

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

// Permanently deletes a feedback and all of its children via the FK cascade
// (comments, events, upvotes, emotes, GitHub connections). There is no
// soft-delete / restore — a future "archive" feature covers the hide-but-keep
// case. `ctx.orm.delete` (not `ctx.db.delete`) is required so the cascade fires.
export const remove = authMutation
  .input(
    z.object({
      id: idSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { feedback, permissions } = await verifyFeedbackWriteAccess(
      ctx,
      input.id,
      ctx.userId
    )
    assertCanAdminFeedback(permissions)

    await ctx.orm
      .delete(feedbackTable)
      .where(eq(feedbackTable.id, feedback._id))

    return { deleted: true }
  })

export const updateStatus = authMutation
  .input(
    z.object({
      id: idSchema,
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
      id: idSchema,
      title: feedbackTitleSchema,
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
      id: idSchema,
      boardId: idSchema,
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
      commentId: nullableIdSchema,
      feedbackId: idSchema,
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
      await ctx.orm
        .update(feedbackTable)
        .set({
          answerCommentId: unsetToken,
          updatedTime: Date.now(),
        })
        .where(eq(feedbackTable.id, feedback._id))
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

    await ctx.orm
      .update(feedbackTable)
      .set({
        answerCommentId: input.commentId as any,
        updatedTime: Date.now(),
      })
      .where(eq(feedbackTable.id, feedback._id))
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
      assignedProfileId: nullableIdSchema,
      feedbackId: idSchema,
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
      if (!isProjectEditorRole(assigneeProjectMember.role)) {
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
      feedbackId: idSchema,
      target: targetSchema.nullable(),
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

export const getDetailCritical = optionalAuthQuery
  .input(
    z.object({
      projectId: idSchema,
      slug: generatedSlugSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const feedback = await ctx.db
      .query("feedback")
      .withIndex("by_projectId_slug", (q: any) =>
        q
          .eq("projectId", asId<"project">(input.projectId))
          .eq("slug", input.slug)
      )
      .first()
    if (!feedback) return null

    const access = await getProjectViewAccess(ctx, {
      id: input.projectId,
      userId: ctx.userId,
    })
    if (!access.permissions.canView) return null

    const [author, board, firstComment] = await Promise.all([
      getDoc<"profile">(ctx, feedback.authorProfileId),
      getDoc<"feedbackBoard">(ctx, feedback.boardId),
      getDoc<"feedbackComment">(ctx, feedback.firstCommentId),
    ])
    const commentWindow = await getFeedbackCommentWindow(ctx, {
      feedbackId: feedback._id,
    })
    // Head and tail overlap for short threads, so enrich each unique comment
    // once (sharing author/team-member lookups) instead of twice.
    const cache = createCommentEnrichCache()
    const enrichedById = new Map<
      string,
      Awaited<ReturnType<typeof toPublicFeedbackComment>>
    >()
    await Promise.all(
      dedupeDocsById([...commentWindow.head, ...commentWindow.tail]).map(
        async (comment: Doc<"feedbackComment">) => {
          enrichedById.set(
            comment._id,
            await toPublicFeedbackComment(
              ctx,
              comment,
              input.projectId,
              access.profile,
              cache
            )
          )
        }
      )
    )
    const head = commentWindow.head
      .map((comment: Doc<"feedbackComment">) => enrichedById.get(comment._id))
      .filter(Boolean)
    const tail = commentWindow.tail
      .map((comment: Doc<"feedbackComment">) => enrichedById.get(comment._id))
      .filter(Boolean)

    return {
      author: await toProfileSummary(author),
      board: board
        ? {
            id: board._id,
            icon: board.icon,
            name: board.name,
            slug: board.slug,
          }
        : null,
      commentWindow: {
        head: dedupeComments(head),
        middleCursor: commentWindow.middleCursor,
        tail: dedupeComments(tail),
        tailCommentIds: commentWindow.tailCommentIds,
      },
      feedback: toPublicFeedbackDoc(feedback),
      firstComment: firstComment
        ? {
            ...toPublicDoc(firstComment),
            authorProfileId: firstComment.authorProfileId,
            content: firstComment.content,
            initial: firstComment.initial,
            updatedTime: firstComment.updatedTime,
          }
        : null,
    }
  })

export const getDetailInteractive = optionalAuthQuery
  .input(
    z.object({
      feedbackId: idSchema,
      projectId: idSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const feedback = await getDoc<"feedback">(
      ctx,
      asId<"feedback">(input.feedbackId)
    )
    if (!feedback || feedback.projectId !== asId<"project">(input.projectId)) {
      return null
    }

    const access = await getProjectViewAccess(ctx, {
      id: input.projectId,
      userId: ctx.userId,
    })
    if (!access.permissions.canView) return null

    const currentProfile = access.profile
    const [assignedProfile, existingUpvote] = await Promise.all([
      getDoc<"profile">(ctx, feedback.assignedProfileId),
      currentProfile
        ? ctx.db
            .query("feedbackUpvote")
            .withIndex("by_feedbackId_authorProfileId", (q: any) =>
              q
                .eq("feedbackId", feedback._id)
                .eq("authorProfileId", currentProfile._id)
            )
            .unique()
        : Promise.resolve(null),
    ])

    return {
      assignedProfile: await toProfileSummary(assignedProfile),
      canMarkAnswer:
        feedback.authorProfileId === currentProfile?._id ||
        access.projectMember?.role === "org:admin",
      currentProfile: await toProfileSummary(currentProfile),
      hasUpvoted: !!existingUpvote,
    }
  })

export const getMiddleComments = optionalAuthQuery
  .input(
    z.object({
      cursor: z.string(),
      feedbackId: idSchema,
      limit: z.number().min(1).max(50).optional(),
      tailCommentIds: idArraySchema.optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    const feedback = await getDoc<"feedback">(
      ctx,
      asId<"feedback">(input.feedbackId)
    )
    if (!feedback) {
      return { comments: [], nextCursor: null }
    }

    const access = await getProjectViewAccess(ctx, {
      id: feedback.projectId,
      userId: ctx.userId,
    })
    if (!access.permissions.canView) {
      return { comments: [], nextCursor: null }
    }

    const tailIds = new Set(input.tailCommentIds ?? [])
    const page = await ctx.db
      .query("feedbackComment")
      .withIndex("by_feedbackId", (q: any) =>
        q.eq("feedbackId", asId<"feedback">(input.feedbackId))
      )
      .order("asc")
      .paginate({
        cursor: input.cursor,
        numItems: input.limit ?? MIDDLE_COMMENT_PAGE_SIZE,
      })
    const hitTail = page.page.some((comment: Doc<"feedbackComment">) =>
      tailIds.has(comment._id)
    )
    const visibleComments = page.page.filter(
      (comment: Doc<"feedbackComment">) => !tailIds.has(comment._id)
    )
    const cache = createCommentEnrichCache()
    const comments = await Promise.all(
      visibleComments.map((comment: Doc<"feedbackComment">) =>
        toPublicFeedbackComment(
          ctx,
          comment,
          feedback.projectId,
          access.profile,
          cache
        )
      )
    )

    return {
      comments,
      nextCursor: page.isDone || hitTail ? null : page.continueCursor,
    }
  })

export const listProjectFeedback = optionalAuthQuery
  .input(
    z.object({
      boardId: idSchema.or(z.literal("all")),
      order: z.enum(["asc", "desc"]).optional(),
      projectId: idSchema,
      search: feedbackSearchSchema.optional(),
      status: feedbackStatusSchema.optional(),
      tags: tagListSchema.optional(),
    })
  )
  .paginated({ limit: 50, item: z.any() })
  .query(async ({ ctx, input }) => {
    const access = await getProjectViewAccess(ctx, {
      id: input.projectId,
      userId: ctx.userId,
    })
    if (!access.permissions.canView) {
      return { continueCursor: "", isDone: true, page: [] }
    }

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
            ...toPublicFeedbackDoc(item),
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
      projectId: idSchema,
      search: feedbackSearchSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const access = await getProjectViewAccess(ctx, {
      id: input.projectId,
      userId: ctx.userId,
    })
    if (!access.permissions.canView) return []

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
      feedback.slice(0, 20).map(async (item: any) => {
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
      ids: idArraySchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const items = await Promise.all(
      input.ids.map(async (id) => await getDoc(ctx, asId<"feedback">(id)))
    )

    // Resolve project visibility once per distinct project, then drop any
    // feedback whose parent project the caller cannot view.
    const projectViewable = new Map<string, boolean>()
    for (const item of items) {
      if (!item) continue
      const key = String(item.projectId)
      if (!projectViewable.has(key)) {
        const access = await getProjectViewAccess(ctx, {
          id: item.projectId,
          userId: ctx.userId,
        })
        projectViewable.set(key, access.permissions.canView)
      }
    }

    const rows = await Promise.all(
      items.map(async (item) => {
        if (!item) return null
        if (!projectViewable.get(String(item.projectId))) return null
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
