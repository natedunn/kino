import { z } from 'zod';
import { eq } from 'kitcn/orm';
import { CRPCError } from 'kitcn/server';
import { authMutation, optionalAuthQuery } from '../lib/crpc';
import { asId, getCurrentProfile, getDoc } from '../lib/kino';
import { feedbackTable, feedbackUpvoteTable } from './schema';

export const toggle = authMutation
  .input(
    z.object({
      feedbackId: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const profile = await getCurrentProfile(ctx, ctx.userId);
    if (!profile) {
      throw new CRPCError({ code: 'UNAUTHORIZED', message: 'You must be logged in to upvote feedback' });
    }

    const feedback = await getDoc(ctx, asId<'feedback'>(input.feedbackId));
    if (!feedback) {
      throw new CRPCError({ code: 'NOT_FOUND', message: 'Feedback not found' });
    }

    const existing = await ctx.db
      .query('feedbackUpvote')
      .withIndex('by_feedbackId_authorProfileId', (q: any) =>
        q.eq('feedbackId', input.feedbackId).eq('authorProfileId', profile._id)
      )
      .unique();

    if (existing) {
      await ctx.orm.delete(feedbackUpvoteTable).where(eq(feedbackUpvoteTable.id, existing._id as any));
      const count = Math.max(0, (feedback.upvotes ?? 0) - 1);
      await ctx.orm.update(feedbackTable).set({ upvotes: count }).where(eq(feedbackTable.id, feedback._id as any));
      return { count, upvoted: false };
    }

    await ctx.orm.insert(feedbackUpvoteTable).values({
      authorProfileId: profile._id as any,
      feedbackId: asId<'feedback'>(input.feedbackId),
    });
    const count = (feedback.upvotes ?? 0) + 1;
    await ctx.orm.update(feedbackTable).set({ upvotes: count }).where(eq(feedbackTable.id, feedback._id as any));
    return { count, upvoted: true };
  });

export const getCount = optionalAuthQuery
  .input(
    z.object({
      feedbackId: z.string(),
    })
  )
  .query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .query('feedbackUpvote')
      .withIndex('by_feedbackId', (q: any) => q.eq('feedbackId', input.feedbackId))
      .collect();
    return rows.length;
  });

export const hasUpvoted = optionalAuthQuery
  .input(
    z.object({
      feedbackId: z.string(),
    })
  )
  .query(async ({ ctx, input }) => {
    const profile = await getCurrentProfile(ctx, ctx.userId);
    if (!profile) return false;

    const existing = await ctx.db
      .query('feedbackUpvote')
      .withIndex('by_feedbackId_authorProfileId', (q: any) =>
        q.eq('feedbackId', input.feedbackId).eq('authorProfileId', profile._id)
      )
      .unique();
    return !!existing;
  });

export const getUpvoteData = optionalAuthQuery
  .input(
    z.object({
      feedbackId: z.string(),
    })
  )
  .query(async ({ ctx, input }) => {
    const profile = await getCurrentProfile(ctx, ctx.userId);
    const feedback = await getDoc(ctx, asId<'feedback'>(input.feedbackId));
    const count = feedback?.upvotes ?? 0;

    if (!profile) return { count, hasUpvoted: false };

    const existing = await ctx.db
      .query('feedbackUpvote')
      .withIndex('by_feedbackId_authorProfileId', (q: any) =>
        q.eq('feedbackId', input.feedbackId).eq('authorProfileId', profile._id)
      )
      .unique();
    return { count, hasUpvoted: !!existing };
  });
