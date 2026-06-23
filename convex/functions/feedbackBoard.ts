import { z } from "zod"
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
import { feedbackBoardTable } from "./schema"

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
    if (!board || !access.project || board.projectId !== access.project._id)
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
    return boards.map((board: any) => toPublicDoc(board))
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
    if (!board || !access.project || board.projectId !== access.project._id) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Board not found" })
    }

    await ctx.orm
      .delete(feedbackBoardTable)
      .where(eq(feedbackBoardTable.id, input.boardId as any))
    return { success: true }
  })

export const remove = _delete
