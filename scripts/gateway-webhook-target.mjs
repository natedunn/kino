#!/usr/bin/env node

// Registers or unregisters this deployment's GitHub webhook receiver with the
// kino-gateway fan-out Worker (workers/gateway). Best-effort by design: when the
// gateway env vars are absent (e.g. a contributor without gateway access) it
// exits 0 so dev/build flows keep working. Stale targets also age out via the
// gateway's KV TTL, so a missed unregister is not fatal.
//
// Usage:
//   node scripts/gateway-webhook-target.mjs register [targetUrl]
//   node scripts/gateway-webhook-target.mjs unregister [targetUrl]
//
// Env:
//   GATEWAY_URL   e.g. https://gateway-dev.usekino.com
//   GATEWAY_ADMIN_TOKEN   bearer token for the gateway /hooks/targets API
//   VITE_CONVEX_URL     used to derive the default target when no URL is given

import { existsSync, readFileSync } from "node:fs"

loadEnvFiles()

const action = process.argv[2]
const explicitTarget = process.argv[3]

if (action !== "register" && action !== "unregister") {
  console.error(
    "Usage: gateway-webhook-target.mjs <register|unregister> [targetUrl]"
  )
  process.exit(1)
}

const gatewayUrl = (process.env.GATEWAY_URL ?? "").replace(/\/$/, "")
const adminToken = process.env.GATEWAY_ADMIN_TOKEN

if (!gatewayUrl || !adminToken) {
  console.log(
    "Skipping gateway webhook target update: GATEWAY_URL or GATEWAY_ADMIN_TOKEN is not set."
  )
  process.exit(0)
}

const targetUrl = explicitTarget ?? defaultTargetUrl()

if (!targetUrl) {
  console.log(
    "Skipping gateway webhook target update: no target URL given and VITE_CONVEX_SITE_URL/VITE_CONVEX_URL is not set."
  )
  process.exit(0)
}

if (!explicitTarget && !targetUrl.startsWith("https://")) {
  console.log(
    `Skipping gateway webhook target update: ${targetUrl} is not publicly reachable.`
  )
  process.exit(0)
}

function loadEnvFiles() {
  for (const path of [".env.local", ".env"]) {
    if (!existsSync(path)) continue

    const lines = readFileSync(path, "utf8").split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue

      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (!match || process.env[match[1]] !== undefined) continue

      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "")
    }
  }
}

function defaultTargetUrl() {
  const convexSiteUrl = process.env.VITE_CONVEX_SITE_URL
  if (convexSiteUrl) {
    return `${convexSiteUrl.replace(/\/$/, "")}/api/github/webhook`
  }

  const convexUrl = process.env.VITE_CONVEX_URL
  if (!convexUrl) return null

  const siteUrl = convexUrl.replace(/\.convex\.cloud$/, ".convex.site")
  return `${siteUrl.replace(/\/$/, "")}/api/github/webhook`
}

async function main() {
  const response = await fetch(`${gatewayUrl}/hooks/targets`, {
    body: JSON.stringify({ url: targetUrl }),
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    },
    method: action === "register" ? "PUT" : "DELETE",
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${response.status} ${response.statusText}: ${body}`)
  }

  console.log(
    `${action === "register" ? "Registered" : "Unregistered"} gateway webhook target ${targetUrl}`
  )
}

try {
  await main()
} catch (error) {
  // Never fail a build/cleanup over webhook fan-out registration.
  console.warn(
    `Gateway webhook target ${action} failed (continuing):`,
    error instanceof Error ? error.message : String(error)
  )
}
