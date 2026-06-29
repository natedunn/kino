import { z } from "zod"
import { privateAction, privateMutation } from "../lib/crpc"
import { sendEmail } from "../lib/nuntly"
import { EMAIL_SENDERS } from "../lib/email-senders"
import { emailEventTable } from "./schema"
import type { EmailSender } from "../lib/email-senders"

const recipientsSchema = z.union([
  z.string().email(),
  z.array(z.string().email()).min(1),
])

const senderSchema = z.enum(
  Object.keys(EMAIL_SENDERS) as [EmailSender, ...Array<EmailSender>]
)

const tagSchema = z.object({
  name: z.string(),
  value: z.string(),
})

/**
 * General-purpose transactional email send via Nuntly. Internal (private) so it
 * is callable from any server context — scheduled jobs, other actions, or a
 * caller — but never directly from an unauthenticated client (that would be a
 * spam vector). For one-off needs you can also import `sendEmail` from
 * `../lib/nuntly` directly inside any action/HTTP-action.
 */
export const sendTransactionalEmail = privateAction
  .input(
    z
      .object({
        sender: senderSchema.optional(),
        from: z.string().optional(),
        to: recipientsSchema,
        cc: recipientsSchema.optional(),
        bcc: recipientsSchema.optional(),
        replyTo: recipientsSchema.optional(),
        subject: z.string().min(1),
        html: z.string().optional(),
        text: z.string().optional(),
        tags: z.array(tagSchema).optional(),
      })
      .refine((value) => value.html || value.text, {
        message: "Provide `html` or `text`.",
      })
  )
  .action(async ({ input }) => {
    const result = await sendEmail(input)
    return { id: result.id, status: result.status }
  })

/**
 * Idempotently record a verified Nuntly webhook event into the append-only
 * backup log. Deduped by the Nuntly event id. Signature verification + payload
 * extraction happen in the HTTP route (convex/functions/emailRoutes.ts); this
 * mutation only persists.
 */
export const recordWebhookEvent = privateMutation
  .input(
    z.object({
      eventId: z.string(),
      type: z.string(),
      emailId: z.string().optional(),
      recipient: z.string().optional(),
      occurredAt: z.number(),
      // The full verified event object; persisted raw into a json() column.
      payload: z.any(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const existing = await ctx.db
      .query("emailEvent")
      .withIndex("by_eventId", (q: any) => q.eq("eventId", input.eventId))
      .unique()
    if (existing) {
      return { duplicate: true as const }
    }

    await ctx.orm.insert(emailEventTable).values({
      eventId: input.eventId,
      type: input.type,
      emailId: input.emailId,
      recipient: input.recipient,
      occurredAt: input.occurredAt,
      receivedTime: Date.now(),
      // Verified Nuntly event object; stored raw for replay/debugging.
      payload: input.payload,
    })

    return { duplicate: false as const }
  })
