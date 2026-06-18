import { z } from 'zod';
import { eq } from 'kitcn/orm';
import { optionalAuthQuery, privateMutation } from '../lib/crpc';
import { asId, getDoc, getProjectViewAccess, toPublicDoc } from '../lib/kino';
import { resolveProfileImageUrl } from '../lib/storage';
import { feedbackEventTable } from './schema';

const feedbackEventTypeSchema = z.enum([
  'status_changed',
  'board_changed',
  'assigned',
  'unassigned',
  'title_changed',
  'answer_marked',
  'answer_unmarked',
]);

const feedbackEventMetadataSchema = z
  .object({
    newValue: z.string().optional(),
    oldValue: z.string().optional(),
    targetProfileId: z.string().optional(),
  })
  .optional();

const COALESCE_WINDOW_MS = 60 * 1000;

function isMarkedForDeletion(feedback: { deletedTime?: number | null } | null) {
  return feedback?.deletedTime != null;
}

async function createOrUpdateFeedbackEvent(
  ctx: { db: any; orm: any },
  input: {
    actorProfileId: string;
    eventType: z.infer<typeof feedbackEventTypeSchema>;
    feedbackId: string;
    metadata?: z.infer<typeof feedbackEventMetadataSchema>;
  }
) {
  const now = Date.now();
  const windowStart = now - COALESCE_WINDOW_MS;

  const recentEvents = await ctx.db
    .query('feedbackEvent')
    .withIndex('by_feedbackId', (q: any) => q.eq('feedbackId', input.feedbackId))
    .order('desc')
    .collect();

  const recentEvent = recentEvents.find(
    (event: any) =>
      event.eventType === input.eventType &&
      event.actorProfileId === input.actorProfileId &&
      event._creationTime >= windowStart
  );

  if (recentEvent) {
    await ctx.orm
      .update(feedbackEventTable)
      .set({
        metadata: {
          ...recentEvent.metadata,
          newValue: input.metadata?.newValue ?? recentEvent.metadata?.newValue,
          oldValue: recentEvent.metadata?.oldValue ?? input.metadata?.oldValue,
          targetProfileId: input.metadata?.targetProfileId ?? recentEvent.metadata?.targetProfileId,
        },
        updatedTime: now,
      })
      .where(eq(feedbackEventTable.id, recentEvent._id as any));
    return recentEvent._id;
  }

  const [event] = await ctx.orm
    .insert(feedbackEventTable)
    .values({
      actorProfileId: input.actorProfileId as any,
      eventType: input.eventType,
      feedbackId: input.feedbackId as any,
      metadata: input.metadata,
      updatedTime: now,
    })
    .returning();
  return event.id;
}

export const create = privateMutation
  .input(
    z.object({
      actorProfileId: z.string(),
      eventType: feedbackEventTypeSchema,
      feedbackId: z.string(),
      metadata: feedbackEventMetadataSchema,
    })
  )
  .mutation(async ({ ctx, input }) => await createOrUpdateFeedbackEvent(ctx, input));

export async function recordFeedbackEvent(
  ctx: { db: any; orm: any },
  input: {
    actorProfileId: string;
    eventType: z.infer<typeof feedbackEventTypeSchema>;
    feedbackId: string;
    metadata?: z.infer<typeof feedbackEventMetadataSchema>;
  }
) {
  return await createOrUpdateFeedbackEvent(ctx, input);
}

export const listByFeedback = optionalAuthQuery
  .input(
    z.object({
      feedbackId: z.string(),
    })
  )
  .query(async ({ ctx, input }) => {
    const feedback = await getDoc(ctx, asId<'feedback'>(input.feedbackId));
    if (!feedback || isMarkedForDeletion(feedback)) return [];

    const access = await getProjectViewAccess(ctx, {
      id: feedback.projectId,
      userId: ctx.userId,
    });
    if (!access.permissions.canView) return [];

    const events = await ctx.db
      .query('feedbackEvent')
      .withIndex('by_feedbackId', (q: any) => q.eq('feedbackId', input.feedbackId))
      .order('asc')
      .collect();

    return await Promise.all(
      events.map(async (event: any) => {
        const actor = await getDoc<'profile'>(ctx, event.actorProfileId);
        const targetProfile = event.metadata?.targetProfileId
          ? await getDoc<'profile'>(ctx, asId<'profile'>(event.metadata.targetProfileId))
          : null;

        return {
          ...toPublicDoc(event),
          actor: actor
            ? {
                id: actor._id,
                imageUrl: await resolveProfileImageUrl(actor),
                name: actor.name,
                username: actor.username,
              }
            : null,
          targetProfile: targetProfile
            ? {
                id: targetProfile._id,
                imageUrl: await resolveProfileImageUrl(targetProfile),
                name: targetProfile.name,
                username: targetProfile.username,
              }
            : null,
        };
      })
    );
  });
