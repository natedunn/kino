import { z } from 'zod';
import { eq } from 'kitcn/orm';
import { CRPCError } from 'kitcn/server';
import { authMutation, optionalAuthQuery } from '../lib/crpc';
import { asId, getDoc, toPublicDoc, verifyProjectAccess } from '../lib/kino';
import { feedbackBoardTable } from './schema';

export const create = authMutation
  .input(
    z.object({
      description: z.string().max(250).optional(),
      icon: z.string().max(50).optional(),
      name: z.string().min(1).max(50),
      projectId: z.string(),
      slug: z.string().min(1),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const access = await verifyProjectAccess(ctx, { id: input.projectId, userId: ctx.userId });
    if (!access.permissions.canEdit) {
      throw new CRPCError({ code: 'FORBIDDEN', message: 'User does not have permission' });
    }

    const existing = await ctx.db
      .query('feedbackBoard')
      .withIndex('by_slug_projectId', (q: any) => q.eq('slug', input.slug).eq('projectId', input.projectId))
      .unique();
    if (existing) {
      throw new CRPCError({ code: 'CONFLICT', message: 'Board with this name already exists' });
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
      .returning();
    return board.id;
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      description: z.string().max(250).optional(),
      icon: z.string().max(50).optional(),
      name: z.string().min(1).max(50).optional(),
      orgSlug: z.string(),
      projectSlug: z.string(),
      slug: z.string().min(1).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const access = await verifyProjectAccess(ctx, { slug: input.projectSlug, userId: ctx.userId });
    if (!access.permissions.canEdit) {
      throw new CRPCError({ code: 'FORBIDDEN', message: 'User does not have permission' });
    }

    if (input.slug || input.name) {
      const board = await getDoc<'feedbackBoard'>(ctx, asId<'feedbackBoard'>(input.id));
      if (!board) {
        throw new CRPCError({ code: 'NOT_FOUND', message: 'Board not found' });
      }
      const existing = await ctx.db
        .query('feedbackBoard')
        .withIndex('by_slug_projectId', (q: any) =>
          q.eq('slug', input.slug ?? board.slug).eq('projectId', board.projectId)
        )
        .unique();

      if (existing && existing._id !== input.id) {
        throw new CRPCError({ code: 'CONFLICT', message: 'Board with this name already exists' });
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
      .where(eq(feedbackBoardTable.id, input.id as any));

    return { success: true };
  });

export const get = optionalAuthQuery
  .input(
    z.object({
      id: z.string(),
      orgSlug: z.string(),
      projectSlug: z.string(),
    })
  )
  .query(async ({ ctx, input }) => {
    const access = await verifyProjectAccess(ctx, { slug: input.projectSlug, userId: ctx.userId });
    if (!access.permissions.canView) return null;
    return toPublicDoc(await getDoc<'feedbackBoard'>(ctx, asId<'feedbackBoard'>(input.id)));
  });

export const listProjectBoards = optionalAuthQuery
  .input(
    z.object({
      projectId: z.string().optional(),
      slug: z.string().optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    const access = await verifyProjectAccess(ctx, {
      id: input.projectId,
      slug: input.projectId ? undefined : input.slug,
      userId: ctx.userId,
    });
    if (!access.permissions.canView || !access.project) return null;

    const boards = await ctx.db
      .query('feedbackBoard')
      .withIndex('by_projectId', (q: any) => q.eq('projectId', access.project._id))
      .collect();
    return boards.map((board: any) => toPublicDoc(board));
  });

export const _delete = authMutation
  .input(
    z.object({
      boardId: z.string(),
      projectId: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const access = await verifyProjectAccess(ctx, { id: input.projectId, userId: ctx.userId });
    if (!access.permissions.canDelete) {
      throw new CRPCError({ code: 'FORBIDDEN', message: 'User does not have permission' });
    }

    await ctx.orm.delete(feedbackBoardTable).where(eq(feedbackBoardTable.id, input.boardId as any));
    return { success: true };
  });

export const remove = _delete;
