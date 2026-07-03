import { CRPCError } from "kitcn/server"
import { publicRoute, router } from "../lib/crpc"
import { verifyNuntlyWebhook } from "../lib/nuntly"
import { createEmailCaller } from "./generated/email.runtime"
import { firstRecipient } from "./emailRoutes.lib"

/**
 * Inbound Nuntly webhook → append-only backup log.
 *
 * Mirrors the GitHub webhook (githubRoutes.ts): read the RAW body, verify the
 * Standard Webhooks signature, then hand off to an internal mutation that dedupes
 * and persists. Returns 200 quickly; Nuntly retries non-200s, so dedupe by event
 * id (in recordWebhookEvent) is what makes retries safe.
 *
 * Endpoint: POST {CONVEX_SITE_URL}/api/email/webhook
 */
export const webhook = publicRoute
  .post("/api/email/webhook")
  .mutation(async ({ ctx, c }) => {
    const body = await c.req.text()

    let event
    try {
      event = await verifyNuntlyWebhook(body, c.req.header("webhook-signature"))
    } catch {
      throw new CRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid webhook signature",
      })
    }

    const data = event.data as Record<string, unknown>

    const occurredAt = Date.parse(event.createdAt)
    const caller = createEmailCaller(ctx)
    const result = await caller.recordWebhookEvent({
      eventId: event.id,
      type: event.type,
      emailId:
        typeof data.id === "string"
          ? data.id
          : typeof data.messageId === "string"
            ? data.messageId
            : undefined,
      recipient: firstRecipient(data.to),
      occurredAt: Number.isNaN(occurredAt) ? Date.now() : occurredAt,
      payload: event,
    })

    return c.json({ ok: true, ...result }, 200)
  })

export const emailRoutes = router({
  webhook,
})
