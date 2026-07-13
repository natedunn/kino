import { getBentoEnv } from "./get-env"

/**
 * Shared Bento access for the whole backend.
 *
 * Deliberately Convex-agnostic so it can be used from anywhere that runs in an
 * action/HTTP-action context (network I/O is required):
 * - the Better Auth send callbacks (convex/functions/auth.ts)
 * - the general-purpose `sendTransactionalEmail` action (convex/functions/email.ts)
 *
 * Do NOT call `sendEmail` from a query or mutation — only actions and HTTP
 * actions may make outbound requests.
 *
 * We talk to Bento's REST batch endpoint directly with `fetch` rather than the
 * Node SDK: `fetch` + `btoa` are native to Convex's default V8 runtime, so
 * there's no dependency that might reach for Node built-ins, and it's trivially
 * testable by stubbing `fetch`.
 */

const BENTO_BATCH_EMAILS_URL = "https://app.bentonow.com/api/v1/batch/emails"

type BentoCredentials = {
  publishableKey: string
  secretKey: string
  siteUuid: string
  from: string
}

function requireCredentials(): BentoCredentials {
  const { publishableKey, secretKey, siteUuid, from } = getBentoEnv()
  const missing = [
    !publishableKey && "BENTO_PUBLISHABLE_KEY",
    !secretKey && "BENTO_SECRET_KEY",
    !siteUuid && "BENTO_SITE_UUID",
    !from && "BENTO_FROM",
  ].filter((name): name is string => Boolean(name))

  if (!publishableKey || !secretKey || !siteUuid || !from) {
    throw new Error(
      `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not set. ` +
        "Add to .env.local (local) and the Convex dashboard (deployed)."
    )
  }

  return { publishableKey, secretKey, siteUuid, from }
}

export type SendEmailArgs = {
  /** Recipient address, or several (one Bento email is queued per recipient). */
  to: string | Array<string>
  subject: string
  /** HTML body — Bento's transactional API is HTML-only (no plain text). */
  html: string
}

/**
 * Send a transactional email through Bento. Reusable building block — call it
 * from Better Auth callbacks, scheduled jobs, or the send action. Resolves to
 * the count of emails Bento accepted for delivery (`results`).
 *
 * The `from` is fixed to `BENTO_FROM` (a verified Bento Author). Bento's batch
 * API accepts one recipient per email object, so an array of `to` fans out to
 * one entry each.
 */
export async function sendEmail(args: SendEmailArgs): Promise<number> {
  const { publishableKey, secretKey, siteUuid, from } = requireCredentials()
  const recipients = Array.isArray(args.to) ? args.to : [args.to]

  const url = `${BENTO_BATCH_EMAILS_URL}?site_uuid=${encodeURIComponent(siteUuid)}`
  const authorization = `Basic ${btoa(`${publishableKey}:${secretKey}`)}`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      emails: recipients.map((to) => ({
        to,
        from,
        subject: args.subject,
        html_body: args.html,
        transactional: true,
      })),
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(
      `Bento email send failed (${response.status})${detail ? `: ${detail}` : ""}`
    )
  }

  // Bento returns `{ results: <number of emails queued> }`.
  const body = (await response.json().catch(() => ({}))) as {
    results?: number
  }
  return typeof body.results === "number" ? body.results : recipients.length
}
