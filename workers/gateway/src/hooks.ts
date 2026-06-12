import {
  isAuthorizedAdmin,
  isTrustedTargetUrl,
  timingSafeEqualString,
  type GatewayEnv,
} from "./env"

/**
 * GitHub App webhook fan-out.
 *
 * The tier GitHub App's single webhook URL points at
 * `${GATEWAY_ORIGIN}/hooks/github`. The gateway verifies the HMAC signature, then
 * forwards the raw payload — original `X-Hub-Signature-256` included — to
 * every registered target. Each target re-verifies the signature with the
 * same tier `GITHUB_RELAY_WEBHOOK_SECRET` and ignores events for installations
 * it doesn't know about (normal under the broadcast model).
 *
 * Targets are app-env webhook receivers (Convex site URLs, which are publicly
 * reachable even for local `convex dev` deployments). They register via the
 * bearer-token API below; deploy/cleanup scripts own the lifecycle, and a TTL
 * ages out anything cleanup missed.
 */

const TARGET_KEY_PREFIX = "target:"
const DEFAULT_TARGET_TTL_SECONDS = 60 * 60 * 24 * 14 // 14 days
const FORWARDED_HEADERS = [
  "content-type",
  "x-github-delivery",
  "x-github-event",
  "x-github-hook-id",
  "x-github-hook-installation-target-id",
  "x-github-hook-installation-target-type",
  "x-hub-signature",
  "x-hub-signature-256",
]

type RegisteredTarget = {
  registeredAt: number
  url: string
}

async function targetKey(url: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(url)
  )
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
  return `${TARGET_KEY_PREFIX}${hash}`
}

async function verifyGitHubSignature(
  env: GatewayEnv,
  body: string,
  signatureHeader: string | null
) {
  if (!signatureHeader?.startsWith("sha256=")) return false

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.GITHUB_RELAY_WEBHOOK_SECRET),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body)
  )
  const expected = `sha256=${Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`
  return timingSafeEqualString(expected, signatureHeader)
}

async function listTargets(env: GatewayEnv) {
  const targets: RegisteredTarget[] = []
  let cursor: string | undefined
  do {
    const page = await env.TARGETS.list({
      cursor,
      prefix: TARGET_KEY_PREFIX,
    })
    const values = await Promise.all(
      page.keys.map((key) => env.TARGETS.get(key.name, "json"))
    )
    for (const value of values) {
      if (value) targets.push(value as RegisteredTarget)
    }
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  return targets
}

async function forwardDelivery(
  request: Request,
  body: string,
  target: RegisteredTarget
) {
  const headers = new Headers()
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  headers.set("user-agent", "kino-gateway")

  try {
    const response = await fetch(target.url, {
      body,
      headers,
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) {
      console.warn(
        `webhook forward to ${target.url} failed: ${response.status}`
      )
    }
  } catch (error) {
    console.warn(
      `webhook forward to ${target.url} errored:`,
      error instanceof Error ? error.message : "unknown error"
    )
  }
}

export async function handleGitHubWebhook(
  env: GatewayEnv,
  request: Request,
  ctx: ExecutionContext
) {
  const body = await request.text()
  const verified = await verifyGitHubSignature(
    env,
    body,
    request.headers.get("x-hub-signature-256")
  )
  if (!verified) {
    return new Response("Invalid signature", { status: 401 })
  }

  const targets = await listTargets(env)
  ctx.waitUntil(
    Promise.allSettled(
      targets.map((target) => forwardDelivery(request, body, target))
    )
  )

  return new Response(
    JSON.stringify({ forwardedTo: targets.length, ok: true }),
    { headers: { "content-type": "application/json" }, status: 202 }
  )
}

export async function handleTargetsApi(env: GatewayEnv, request: Request) {
  if (!isAuthorizedAdmin(env, request)) {
    return new Response("Unauthorized", { status: 401 })
  }

  if (request.method === "GET") {
    const targets = await listTargets(env)
    return new Response(JSON.stringify({ targets }), {
      headers: { "content-type": "application/json" },
      status: 200,
    })
  }

  let url: string
  try {
    const parsed = (await request.json()) as { url?: string }
    if (typeof parsed.url !== "string") throw new Error("missing url")
    url = parsed.url
  } catch {
    return new Response("Body must be JSON with a `url` string", {
      status: 400,
    })
  }

  if (request.method === "PUT") {
    if (!isTrustedTargetUrl(env, url)) {
      return new Response("Target URL is not a trusted origin", {
        status: 400,
      })
    }

    const target: RegisteredTarget = { registeredAt: Date.now(), url }
    await env.TARGETS.put(await targetKey(url), JSON.stringify(target), {
      expirationTtl: DEFAULT_TARGET_TTL_SECONDS,
    })
    return new Response(JSON.stringify({ ok: true, target }), {
      headers: { "content-type": "application/json" },
      status: 200,
    })
  }

  if (request.method === "DELETE") {
    await env.TARGETS.delete(await targetKey(url))
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
      status: 200,
    })
  }

  return new Response("Method not allowed", { status: 405 })
}
