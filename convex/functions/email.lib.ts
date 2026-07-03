import { z } from "zod"
import { EMAIL_SENDERS } from "../lib/email-senders"
import type { EmailSender } from "../lib/email-senders"

export const recipientsSchema = z.union([
  z.string().email(),
  z.array(z.string().email()).min(1),
])

export const senderSchema = z.enum(
  Object.keys(EMAIL_SENDERS) as [EmailSender, ...Array<EmailSender>]
)

export const tagSchema = z.object({
  name: z.string(),
  value: z.string(),
})
