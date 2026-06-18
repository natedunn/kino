import { z } from 'zod';
import { eq } from 'kitcn/orm';
import { CRPCError } from 'kitcn/server';
import { authMutation } from '../lib/crpc';
import { asId, getCurrentProfileOrThrow, getDoc, verifyProjectAccess } from '../lib/kino';
import { feedbackCommentEmoteTable } from './schema';

function isMarkedForDeletion(feedback: { deletedTime?: number | null } | null) {
  return feedback?.deletedTime != null;
}

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
    const feedback = await getDoc(ctx, asId<'feedback'>(input.feedbackId));
    if (!feedback || isMarkedForDeletion(feedback)) {
      throw new CRPCError({ code: 'NOT_FOUND', message: 'Feedback not found' });
    }
    const access = await verifyProjectAccess(ctx, { id: feedback.projectId, userId: ctx.userId });
    if (!access.permissions.canView) {
      throw new CRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this feedback' });
    }
    const comment = await getDoc(ctx, asId<'feedbackComment'>(input.feedbackCommentId));
    if (!comment || comment.feedbackId !== feedback._id) {
      throw new CRPCError({ code: 'BAD_REQUEST', message: 'Invalid feedback comment' });
    }

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
