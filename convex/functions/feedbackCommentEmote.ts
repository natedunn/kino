import { z } from 'zod';
import { eq } from 'kitcn/orm';
import { authMutation } from '../lib/crpc';
import { getCurrentProfileOrThrow } from '../lib/kino';
import { feedbackCommentEmoteTable } from './schema';

export const toggle = authMutation
  .input(
    z.object({
      content: z.enum([
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
      ]),
      feedbackCommentId: z.string(),
      feedbackId: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const profile = await getCurrentProfileOrThrow(ctx, ctx.userId);

    const existingEmote = await ctx.db
      .query('feedbackCommentEmote')
      .withIndex('by_feedbackCommentId', (q: any) => q.eq('feedbackCommentId', input.feedbackCommentId))
      .filter((q: any) =>
        q.and(q.eq(q.field('authorProfileId'), profile._id), q.eq(q.field('content'), input.content))
      )
      .first();

    if (existingEmote) {
      await ctx.orm
        .delete(feedbackCommentEmoteTable)
        .where(eq(feedbackCommentEmoteTable.id, existingEmote._id as any));
      return { action: 'removed' as const };
    }

    await ctx.orm.insert(feedbackCommentEmoteTable).values({
      authorProfileId: profile._id as any,
      content: input.content,
      feedbackCommentId: input.feedbackCommentId as any,
      feedbackId: input.feedbackId as any,
    });
    return { action: 'added' as const };
  });
