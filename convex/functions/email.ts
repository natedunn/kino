import { z } from "zod"
import { privateAction } from "../lib/crpc"
import { sendEmail } from "../lib/bento"
import { recipientsSchema } from "./email.lib"

/**
 * General-purpose transactional email send via Bento. Internal (private) so it
 * is callable from any server context — scheduled jobs, other actions, or a
 * caller — but never directly from an unauthenticated client (that would be a
 * spam vector). For one-off needs you can also import `sendEmail` from
 * `../lib/bento` directly inside any action/HTTP-action.
 *
 * Bento's transactional API is HTML-only and sends from the single verified
 * `BENTO_FROM` Author (no per-message from/reply-to/cc/bcc). Returns the count
 * of emails Bento accepted for delivery.
 */
export const sendTransactionalEmail = privateAction
  .input(
    z.object({
      to: recipientsSchema,
      subject: z.string().min(1),
      html: z.string().min(1),
    })
  )
  .action(async ({ input }) => {
    const count = await sendEmail(input)
    return { count }
  })
