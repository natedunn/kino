import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"
import { internalMutation } from "./generated/server"

// githubWebhookDelivery rows exist for dedupe (GitHub redelivers within days,
// the gateway retries within minutes) and debugging. Anything older than the
// retention window is dead weight; without this sweep the table grows
// unbounded with every delivery.
const WEBHOOK_DELIVERY_RETENTION_MS = 1000 * 60 * 60 * 24 * 30 // 30 days
const CLEANUP_BATCH_SIZE = 200

export const cleanupWebhookDeliveries = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - WEBHOOK_DELIVERY_RETENTION_MS
    const stale = await ctx.db
      .query("githubWebhookDelivery")
      .withIndex("by_receivedTime", (q: any) => q.lt("receivedTime", cutoff))
      .take(CLEANUP_BATCH_SIZE)

    for (const row of stale) {
      await ctx.db.delete(row._id)
    }

    // Stay within transaction limits: if a full batch was deleted there may
    // be more, so reschedule immediately to continue.
    if (stale.length === CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.crons.cleanupWebhookDeliveries,
        {}
      )
    }

    return null
  },
})

// emailEvent rows are an append-only audit/backup log of Nuntly delivery events
// (deduped by event id). Like githubWebhookDelivery, without a sweep the table
// grows unbounded with every delivery/open/click event. Replay/debugging value
// is recent, so we keep the same 30-day window.
const EMAIL_EVENT_RETENTION_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

export const cleanupEmailEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - EMAIL_EVENT_RETENTION_MS
    const stale = await ctx.db
      .query("emailEvent")
      .withIndex("by_receivedTime", (q: any) => q.lt("receivedTime", cutoff))
      .take(CLEANUP_BATCH_SIZE)

    for (const row of stale) {
      await ctx.db.delete(row._id)
    }

    // Stay within transaction limits: if a full batch was deleted there may
    // be more, so reschedule immediately to continue.
    if (stale.length === CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.crons.cleanupEmailEvents, {})
    }

    return null
  },
})

const crons = cronJobs()

crons.interval(
  "cleanup old github webhook deliveries",
  { hours: 24 },
  internal.crons.cleanupWebhookDeliveries,
  {}
)

crons.interval(
  "cleanup old email events",
  { hours: 24 },
  internal.crons.cleanupEmailEvents,
  {}
)

export default crons
