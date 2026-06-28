import { Nuntly, verifyWebhook } from "@nuntly/sdk"
import { getNuntlyEnv } from "./get-env"
import { resolveSender } from "./email-senders"
import type { EmailSender } from "./email-senders"
import type {
  CreateEmailRequest,
  CreateEmailResponse,
  Event as NuntlyEvent,
} from "@nuntly/sdk"

/**
 * Shared Nuntly access for the whole backend.
 *
 * This module is deliberately Convex-agnostic so it can be used from anywhere
 * that runs in an action/HTTP-action context (network I/O is required):
 * - Better Auth send callbacks (via `@nuntly/better-email`'s `NuntlyProvider`)
 * - the general-purpose `sendTransactionalEmail` action (convex/functions/email.ts)
 * - the inbound webhook route (convex/functions/emailRoutes.ts)
 *
 * Do NOT call `sendEmail`/`getNuntlyClient` from a query or mutation — only
 * actions and HTTP actions may make outbound requests.
 */

function requireApiKey() {
  const { apiKey } = getNuntlyEnv()
  if (!apiKey) {
    throw new Error(
      "NUNTLY_API_KEY is not set. Add it to .env.local (local) and the " +
        "Convex dashboard (deployed)."
    )
  }
  return apiKey
}

/** A configured Nuntly SDK client. Use for any direct Nuntly API call. */
export function getNuntlyClient() {
  return new Nuntly({ apiKey: requireApiKey() })
}

export type SendEmailArgs = Omit<CreateEmailRequest, "from"> & {
  /**
   * Which named sender to use (auth / billing / support / noreply / …). The
   * registry (lib/email-senders.ts) resolves it to a `from` on the verified
   * sending domain plus an optional `replyTo`. Defaults to `noreply`.
   */
  sender?: EmailSender
  /** Explicit `from` override. Takes precedence over `sender`. */
  from?: string
}

/**
 * Send a transactional email through Nuntly. Reusable building block — call it
 * from Better Auth callbacks, scheduled jobs, or the send action. Resolves to
 * `{ id, status }`.
 *
 * Sender resolution: explicit `from` > `sender` registry > NUNTLY_FROM. A
 * sender's `replyTo` is applied only when the caller didn't pass one.
 */
export async function sendEmail(
  args: SendEmailArgs
): Promise<CreateEmailResponse> {
  const { sender, from: fromOverride, replyTo, ...rest } = args

  let from = fromOverride
  let resolvedReplyTo = replyTo
  if (!from) {
    const resolved = resolveSender(sender)
    from = resolved.from
    resolvedReplyTo = replyTo ?? resolved.replyTo
  }

  return getNuntlyClient().emails.send({
    ...rest,
    from,
    ...(resolvedReplyTo ? { replyTo: resolvedReplyTo } : {}),
  })
}

/**
 * Verify a Standard Webhooks signature and return the typed Nuntly event.
 * Throws `WebhookVerificationError` on a bad/missing/expired signature.
 *
 * Pass the RAW request body string (not a parsed object) and the
 * `webhook-signature` header value.
 */
export async function verifyNuntlyWebhook(
  rawBody: string,
  signatureHeader: string | null | undefined
): Promise<NuntlyEvent> {
  const { webhookSecret } = getNuntlyEnv()
  if (!webhookSecret) {
    throw new Error("NUNTLY_WEBHOOK_SECRET is not set.")
  }
  if (!signatureHeader) {
    throw new Error("Missing webhook-signature header.")
  }
  return verifyWebhook(rawBody, signatureHeader, webhookSecret)
}

export type { NuntlyEvent }
