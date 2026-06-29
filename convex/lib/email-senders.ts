import { getNuntlyEnv } from "./get-env"

/**
 * The closed set of email senders. This is the single source of truth.
 *
 * - `name`     — the exact `From` display name (no derivation/auto-casing; what
 *                you write is what recipients see).
 * - `localPart`— the mailbox before the `@`. Combined with the verified Nuntly
 *                sending domain (NUNTLY_EMAIL_DOMAIN, e.g. `mail.usekino.com`) to
 *                form the address. Mailboxes need not exist — they're labels.
 * - `reply`    — when `true`, human replies route to NUNTLY_REPLY_TO (e.g.
 *                `hello@usekino.com`, which may live on a different domain since
 *                reply-to isn't validated for sending).
 *
 * `sender` keys are the ONLY accepted values: callers are typed against
 * `EmailSender`, so any other string is a compile error, and the send action's
 * zod enum rejects unknown values at runtime. Local-parts are constants here —
 * never user input — so there's nothing to sanitize. To add a sender, add a key.
 */
export const EMAIL_SENDERS = {
  auth: { name: "Kino — Auth", localPart: "auth" },
  billing: { name: "Kino — Billing", localPart: "billing", reply: true },
  support: { name: "Kino — Support", localPart: "support", reply: true },
  noreply: { name: "Kino", localPart: "noreply" },
} as const

export type EmailSender = keyof typeof EMAIL_SENDERS

/** The sender used when a caller doesn't specify one. */
export const DEFAULT_SENDER: EmailSender = "noreply"

function domainFromAddress(address: string | undefined): string | undefined {
  if (!address) return undefined
  // Accepts "Name <local@domain>" or "local@domain".
  const match = address.match(/<([^>]+)>/)
  const bare = (match ? match[1] : address).trim()
  const at = bare.lastIndexOf("@")
  return at === -1 ? undefined : bare.slice(at + 1) || undefined
}

/** The verified Nuntly sending domain (explicit env, else derived from FROM). */
export function getSendingDomain(): string {
  const { emailDomain, fromAddress } = getNuntlyEnv()
  const domain = emailDomain ?? domainFromAddress(fromAddress)
  if (!domain) {
    throw new Error(
      "No Nuntly sending domain configured. Set NUNTLY_EMAIL_DOMAIN " +
        "(e.g. mail.usekino.com) or NUNTLY_FROM."
    )
  }
  return domain
}

/**
 * Resolve a sender key to a concrete `{ from, replyTo? }`. The `from` is always
 * on the verified sending domain; `replyTo` is included only for senders that
 * opt in AND when NUNTLY_REPLY_TO is configured.
 */
export function resolveSender(sender: EmailSender = DEFAULT_SENDER): {
  from: string
  replyTo?: string
} {
  const def = EMAIL_SENDERS[sender]
  const from = `${def.name} <${def.localPart}@${getSendingDomain()}>`

  // Senders flagged `reply: true` route human replies to NUNTLY_REPLY_TO.
  const replyTo = "reply" in def ? getNuntlyEnv().replyTo : undefined

  return replyTo ? { from, replyTo } : { from }
}
