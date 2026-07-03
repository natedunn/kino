import { z } from "zod"
import { eq } from "kitcn/orm"
import { idSchema } from "../lib/validation"
import { feedbackEventTable } from "./schema"

export const feedbackEventTypeSchema = z.enum([
  "status_changed",
  "board_changed",
  "assigned",
  "unassigned",
  "title_changed",
  "answer_marked",
  "answer_unmarked",
])

export const feedbackEventMetadataSchema = z
  .object({
    newValue: z.string().trim().max(256).optional(),
    oldValue: z.string().trim().max(256).optional(),
    targetProfileId: idSchema.optional(),
  })
  .optional()

export const COALESCE_WINDOW_MS = 60 * 1000

export async function createOrUpdateFeedbackEvent(
  ctx: { db: any; orm: any },
  input: {
    actorProfileId: string
    eventType: z.infer<typeof feedbackEventTypeSchema>
    feedbackId: string
    metadata?: z.infer<typeof feedbackEventMetadataSchema>
  }
) {
  const now = Date.now()
  const windowStart = now - COALESCE_WINDOW_MS

  const recentEvents = await ctx.db
    .query("feedbackEvent")
    .withIndex("by_feedbackId", (q: any) =>
      q.eq("feedbackId", input.feedbackId)
    )
    .order("desc")
    .collect()

  const recentEvent = recentEvents.find(
    (event: any) =>
      event.eventType === input.eventType &&
      event.actorProfileId === input.actorProfileId &&
      event._creationTime >= windowStart
  )

  if (recentEvent) {
    await ctx.orm
      .update(feedbackEventTable)
      .set({
        metadata: {
          ...recentEvent.metadata,
          newValue: input.metadata?.newValue ?? recentEvent.metadata?.newValue,
          oldValue: recentEvent.metadata?.oldValue ?? input.metadata?.oldValue,
          targetProfileId:
            input.metadata?.targetProfileId ??
            recentEvent.metadata?.targetProfileId,
        },
        updatedTime: now,
      })
      .where(eq(feedbackEventTable.id, recentEvent._id))
    return recentEvent._id
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
    .returning()
  return event.id
}

export async function recordFeedbackEvent(
  ctx: { db: any; orm: any },
  input: {
    actorProfileId: string
    eventType: z.infer<typeof feedbackEventTypeSchema>
    feedbackId: string
    metadata?: z.infer<typeof feedbackEventMetadataSchema>
  }
) {
  return await createOrUpdateFeedbackEvent(ctx, input)
}
