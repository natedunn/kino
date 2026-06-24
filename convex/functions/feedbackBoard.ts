import { z } from "zod"
import { v } from "convex/values"
import { eq } from "kitcn/orm"
import { CRPCError } from "kitcn/server"
import { authMutation, optionalAuthQuery } from "../lib/crpc"
import { asId, getDoc, toPublicDoc, verifyProjectAccess } from "../lib/kino"
import {
  boardDescriptionSchema,
  boardIconSchema,
  boardNameSchema,
  idSchema,
  orgSlugSchema,
  projectSlugSchema,
  projectSlugWriteSchema,
} from "../lib/validation"
import { internal } from "./_generated/api"
import { internalMutation, withOrm } from "./generated/server"
import { feedbackBoardTable, feedbackTable } from "./schema"

// A board delete cascades board → feedback → each feedback's comments, events,
// upvotes, emotes, and GitHub connections. Doing that for a large board in a
// single `ctx.orm.delete` could exceed Convex's per-mutation document limit, so
// non-empty boards are soft-hidden and their feedback purged in bounded batches
// by `purgeBoard` (each feedback delete hard-cascades to its own children).
const BOARD_FEEDBACK_PURGE_BATCH_SIZE = 50

export const create = authMutation
  .input(
    z.object({
      description: boardDescriptionSchema.optional(),
      icon: boardIconSchema.optional(),
      name: boardNameSchema,
      projectId: idSchema,
      slug: projectSlugWriteSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const access = await verifyProjectAccess(ctx, {
      id: input.projectId,
      userId: ctx.userId,
    })
    if (!access.permissions.canEdit) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "User does not have permission",
      })
    }

    const existing = await ctx.db
      .query("feedbackBoard")
      .withIndex("by_slug_projectId", (q: any) =>
        q.eq("slug", input.slug).eq("projectId", input.projectId)
      )
      .unique()
    if (existing) {
      throw new CRPCError({
        code: "CONFLICT",
        message: "Board with this name already exists",
      })
    }

    const [board] = await ctx.orm
      .insert(feedbackBoardTable)
      .values({
        description: input.description ?? null,
        icon: input.icon ?? null,
        name: input.name,
        projectId: input.projectId as any,
        slug: input.slug,
      })
      .returning()
    return board.id
  })

export const update = authMutation
  .input(
    z.object({
      id: idSchema,
      description: boardDescriptionSchema.optional(),
      icon: boardIconSchema.optional(),
      name: boardNameSchema.optional(),
      orgSlug: orgSlugSchema,
      projectSlug: projectSlugSchema,
      slug: projectSlugWriteSchema.optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const access = await verifyProjectAccess(ctx, {
      slug: input.projectSlug,
      userId: ctx.userId,
    })
    if (!access.permissions.canEdit) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "User does not have permission",
      })
    }

    const board = await getDoc<"feedbackBoard">(
      ctx,
      asId<"feedbackBoard">(input.id)
    )
    if (!board) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Board not found" })
    }
    if (!access.project || board.projectId !== access.project._id) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Board does not belong to this project",
      })
    }

    if (input.slug || input.name) {
      const existing = await ctx.db
        .query("feedbackBoard")
        .withIndex("by_slug_projectId", (q: any) =>
          q
            .eq("slug", input.slug ?? board.slug)
            .eq("projectId", board.projectId)
        )
        .unique()

      if (existing && existing._id !== input.id) {
        throw new CRPCError({
          code: "CONFLICT",
          message: "Board with this name already exists",
        })
      }
    }

    await ctx.orm
      .update(feedbackBoardTable)
      .set({
        description: input.description,
        icon: input.icon,
        name: input.name,
        slug: input.slug,
        updatedTime: Date.now(),
      })
      .where(eq(feedbackBoardTable.id, input.id as any))

    return { success: true }
  })

export const get = optionalAuthQuery
  .input(
    z.object({
      id: idSchema,
      orgSlug: orgSlugSchema,
      projectSlug: projectSlugSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const access = await verifyProjectAccess(ctx, {
      slug: input.projectSlug,
      userId: ctx.userId,
    })
    if (!access.permissions.canView) return null
    const board = await getDoc<"feedbackBoard">(
      ctx,
      asId<"feedbackBoard">(input.id)
    )
    if (
      !board ||
      board.deletedTime != null ||
      !access.project ||
      board.projectId !== access.project._id
    )
      return null
    return toPublicDoc(board)
  })

export const listProjectBoards = optionalAuthQuery
  .input(
    z.object({
      projectId: idSchema.optional(),
      slug: projectSlugSchema.optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    const access = await verifyProjectAccess(ctx, {
      id: input.projectId,
      slug: input.projectId ? undefined : input.slug,
      userId: ctx.userId,
    })
    if (!access.permissions.canView || !access.project) return null

    const boards = await ctx.db
      .query("feedbackBoard")
      .withIndex("by_projectId", (q: any) =>
        q.eq("projectId", access.project._id)
      )
      .collect()
    // Hide boards that are mid-deletion (soft-hidden by `_delete` while their
    // feedback is purged in the background).
    return boards
      .filter((board: any) => board.deletedTime == null)
      .map((board: any) => toPublicDoc(board))
  })

export const _delete = authMutation
  .input(
    z.object({
      boardId: idSchema,
      projectId: idSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const access = await verifyProjectAccess(ctx, {
      id: input.projectId,
      userId: ctx.userId,
    })
    if (!access.permissions.canDelete) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "User does not have permission",
      })
    }

    const board = await getDoc<"feedbackBoard">(
      ctx,
      asId<"feedbackBoard">(input.boardId)
    )
    if (
      !board ||
      board.deletedTime != null ||
      !access.project ||
      board.projectId !== access.project._id
    ) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Board not found" })
    }

    // Fast path: an empty board has no cascading children, so delete it inline.
    const firstFeedback = await ctx.db
      .query("feedback")
      .withIndex("by_boardId", (q: any) => q.eq("boardId", board._id))
      .take(1)

    if (firstFeedback.length === 0) {
      await ctx.orm
        .delete(feedbackBoardTable)
        .where(eq(feedbackBoardTable.id, input.boardId as any))
      return { success: true }
    }

    // Non-empty board: soft-hide it now so it disappears from the UI, then purge
    // its feedback in bounded batches in the background before removing the row.
    const now = Date.now()
    await ctx.orm
      .update(feedbackBoardTable)
      .set({ deletedTime: now, updatedTime: now })
      .where(eq(feedbackBoardTable.id, input.boardId as any))
    await ctx.scheduler.runAfter(0, internal.feedbackBoard.purgeBoard, {
      boardId: board._id,
    })
    return { success: true }
  })

export const remove = _delete

// Deletes a soft-hidden board's feedback in bounded batches (each feedback
// delete cascades to its comments/events/upvotes/emotes/GitHub connections),
// rescheduling itself until none remain, then removes the board row. Internal
// only — entered via `_delete`'s scheduler call.
export const purgeBoard = internalMutation({
  args: { boardId: v.id("feedbackBoard") },
  handler: async (ctx, { boardId }) => {
    const octx = withOrm(ctx)

    const due = await ctx.db
      .query("feedback")
      .withIndex("by_boardId", (q: any) => q.eq("boardId", boardId))
      .take(BOARD_FEEDBACK_PURGE_BATCH_SIZE)

    for (const row of due) {
      await octx.orm.delete(feedbackTable).where(eq(feedbackTable.id, row._id))
    }

    if (due.length === BOARD_FEEDBACK_PURGE_BATCH_SIZE) {
      // A full batch likely means more feedback remain; continue before the
      // board itself is removed.
      await ctx.scheduler.runAfter(0, internal.feedbackBoard.purgeBoard, {
        boardId,
      })
      return null
    }

    // All feedback gone — remove the (already soft-hidden) board row.
    await octx.orm
      .delete(feedbackBoardTable)
      .where(eq(feedbackBoardTable.id, boardId))
    return null
  },
})
