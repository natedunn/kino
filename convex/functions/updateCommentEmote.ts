import { z } from 'zod';
import { eq } from 'kitcn/orm';
import { CRPCError } from 'kitcn/server';
import { authMutation } from '../lib/crpc';
import { getCurrentProfileOrThrow, asId, getDocOrThrow, verifyProjectAccess } from '../lib/kino';
import { updateCommentEmoteTable } from './schema';

const emoteContentSchema = z.enum([
  'thumbsUp',
  'thumbsDown',
  'laugh',
  'questionMark',
  'sad',
  'tada',
  'eyes',
  'heart',
  'skull',
  'explodingHead',
]);

export const toggle = authMutation
  .input(
    z.object({
      content: emoteContentSchema,
      updateCommentId: z.string(),
      updateId: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const profile = await getCurrentProfileOrThrow(ctx, ctx.userId);
    const comment = await getDocOrThrow(ctx, asId<'updateComment'>(input.updateCommentId), 'Comment not found');
    const item = await getDocOrThrow(ctx, asId<'update'>(input.updateId), 'Update not found');

    if (comment.updateId !== item._id) {
      throw new CRPCError({ code: 'BAD_REQUEST', message: 'Comment does not belong to this update' });
    }

    if (item.status === 'draft') {
      const project = await getDocOrThrow(ctx, item.projectId, 'Project not found');
      const access = await verifyProjectAccess(ctx, { slug: project.slug, userId: ctx.userId });
      if (!access.permissions.canEdit) {
        throw new CRPCError({
          code: 'FORBIDDEN',
          message: 'You cannot react to comments on draft updates',
        });
      }
    }

    const existing = await ctx.db
      .query('updateCommentEmote')
      .withIndex('by_updateCommentId', (q: any) => q.eq('updateCommentId', comment._id))
      .filter((q: any) =>
        q.and(q.eq(q.field('authorProfileId'), profile._id), q.eq(q.field('content'), input.content))
      )
      .first();

    if (existing) {
      await ctx.orm
        .delete(updateCommentEmoteTable)
        .where(eq(updateCommentEmoteTable.id, existing._id as any));
      return { action: 'removed' as const };
    }

    await ctx.orm.insert(updateCommentEmoteTable).values({
      authorProfileId: profile._id as any,
      content: input.content,
      updateCommentId: comment._id as any,
      updateId: item._id as any,
    });
    return { action: 'added' as const };
  });
