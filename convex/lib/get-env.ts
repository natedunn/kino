import { createEnv } from "kitcn/server"
import { z } from "zod"

const envSchema = z.object({
  SITE_URL: z.string().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z.string().optional(),
  TRUSTED_ORIGINS: z.string().optional(),
  TRUSTED_HOSTS: z.string().optional(),
  CLOUDFLARE_WORKER_NAME: z.string().optional(),
  OAUTH_PROXY_PRODUCTION_URL: z.string().optional(),
})

function getRuntimeEnv() {
  return (
    (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env ?? {}
  )
}

const DEFAULT_CLOUDFLARE_WORKER_NAME = "kino"

export function getEnv() {
  const runtimeEnv = getRuntimeEnv()
  return createEnv({
    schema: envSchema,
    runtimeEnv: {
      BETTER_AUTH_SECRET: runtimeEnv.BETTER_AUTH_SECRET,
      SITE_URL: runtimeEnv.SITE_URL,
      TRUSTED_HOSTS: runtimeEnv.TRUSTED_HOSTS,
      TRUSTED_ORIGINS: runtimeEnv.TRUSTED_ORIGINS,
      OAUTH_PROXY_PRODUCTION_URL: runtimeEnv.OAUTH_PROXY_PRODUCTION_URL,
      CLOUDFLARE_WORKER_NAME:
        runtimeEnv.CLOUDFLARE_WORKER_NAME ??
        runtimeEnv.WORKER_NAME ??
        runtimeEnv.CF_WORKER_NAME ??
        DEFAULT_CLOUDFLARE_WORKER_NAME,
    },
    cache: false,
  })()
}

function getRuntimeEnvValue(parts: Array<string>) {
  return getRuntimeEnv()[parts.join("_")]
}

/**
 * Naming scheme — three things, three names:
 * - "Auth"    = the GitHub OAuth app used for user login     (GITHUB_AUTH_*)
 * - "Relay"   = the GitHub App used for org/repo sync        (GITHUB_RELAY_*)
 * - "Gateway" = the per-tier Cloudflare Worker fronting both (GATEWAY_*)
 */

/** GitHub OAuth app used for user login ("Kino Auth"). */
export function getGitHubAuthEnv() {
  return {
    clientId: getRuntimeEnvValue(["GITHUB", "AUTH", "CLIENT", "ID"]),
    clientSecret: getRuntimeEnvValue(["GITHUB", "AUTH", "CLIENT", "SECRET"]),
  }
}

/** GitHub App used for org/repo sync ("Kino Relay"). */
export function getGitHubRelayEnv() {
  const value = (parts: Array<string>) =>
    getRuntimeEnvValue(["GITHUB", "RELAY", ...parts])

  return {
    appId: value(["APP", "ID"]),
    callbackTargetUrl: value(["CALLBACK", "TARGET", "URL"]),
    clientId: value(["CLIENT", "ID"]),
    clientSecret: value(["CLIENT", "SECRET"]),
    privateKey: value(["PRIVATE", "KEY"]),
    slug: value(["SLUG"]),
    stateSecret: value(["STATE", "SECRET"]),
    webhookSecret: value(["WEBHOOK", "SECRET"]),
  }
}

/**
 * Bento transactional email service.
 * - publishableKey / secretKey: the API credential pair, combined into HTTP
 *   Basic auth for every request to the Bento API.
 * - siteUuid: the Bento site identifier, sent with every request.
 * - from: the verified sender address. MUST match an Author configured in
 *   Bento (Bento only sends from configured Authors). Accepts a bare address
 *   ("noreply@mail.usekino.com") or a display-name form
 *   ("Kino <noreply@mail.usekino.com>").
 *
 * Note: Bento's transactional API has no per-message reply-to/cc/bcc and no
 * plain-text body — reply-to is a global Bento setting, and we send HTML only.
 */
export function getBentoEnv() {
  const value = (parts: Array<string>) =>
    getRuntimeEnvValue(["BENTO", ...parts])

  return {
    publishableKey: value(["PUBLISHABLE", "KEY"]),
    secretKey: value(["SECRET", "KEY"]),
    siteUuid: value(["SITE", "UUID"]),
    from: value(["FROM"]),
  }
}

export function getJwksEnv() {
  return getRuntimeEnvValue(["JWKS"])
}

export function getOAuthProxySecretEnv() {
  return getRuntimeEnvValue(["OAUTH", "PROXY", "SECRET"])
}

export function getOAuthProxyProductionUrlEnv() {
  return getRuntimeEnvValue(["OAUTH", "PROXY", "PRODUCTION", "URL"])
}

function parseList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeOrigin(origin: string) {
  return origin.endsWith("/") ? origin.slice(0, -1) : origin
}

function normalizeHostPattern(host: string) {
  return host
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
}

function isLoopbackHostname(hostname: string) {
  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  )
}

function getLoopbackOrigins(siteUrl: string) {
  try {
    const { hostname } = new URL(siteUrl)
    if (!isLoopbackHostname(hostname)) return []
  } catch {
    return []
  }

  return ["http://localhost:*", "http://127.0.0.1:*", "http://[::1]:*"]
}

function getLoopbackHosts(siteUrl: string) {
  if (getLoopbackOrigins(siteUrl).length === 0) return []
  return ["localhost:*", "127.0.0.1:*", "[::1]:*"]
}

function getPortlessOrigins(siteUrl: string) {
  if (getLoopbackOrigins(siteUrl).length === 0) return []
  return [
    "https://*.localhost",
    "https://*.localhost:*",
    "http://*.localhost",
    "http://*.localhost:*",
  ]
}

function getPortlessHosts(siteUrl: string) {
  if (getLoopbackOrigins(siteUrl).length === 0) return []
  return ["*.localhost", "*.localhost:*"]
}

function hostnameFromOriginPattern(origin: string) {
  if (origin.includes("*")) {
    return normalizeHostPattern(origin)
  }

  try {
    return new URL(origin).host
  } catch {
    return normalizeHostPattern(origin)
  }
}

function getCloudflarePreviewOrigins(workerName: string | undefined) {
  if (!workerName) return []

  const normalizedWorkerName = workerName.trim().toLowerCase()
  if (!normalizedWorkerName) return []

  return [
    `https://${normalizedWorkerName}.*.workers.dev`,
    `https://*-${normalizedWorkerName}.*.workers.dev`,
  ]
}

function getAdditionalDeploymentOrigins() {
  const runtimeEnv = getRuntimeEnv()
  const deploymentOrigins = [
    runtimeEnv.CF_PAGES_URL,
    runtimeEnv.URL,
    runtimeEnv.DEPLOY_PRIME_URL,
    runtimeEnv.RENDER_EXTERNAL_URL,
    runtimeEnv.VERCEL_URL
      ? `https://${runtimeEnv.VERCEL_URL.replace(/^https?:\/\//, "")}`
      : undefined,
  ]

  return deploymentOrigins
    .filter(
      (origin): origin is string =>
        typeof origin === "string" && origin.length > 0
    )
    .map(normalizeOrigin)
}

export function getTrustedOrigins() {
  const env = getEnv()
  return Array.from(
    new Set(
      [
        env.SITE_URL,
        ...getLoopbackOrigins(env.SITE_URL),
        ...getPortlessOrigins(env.SITE_URL),
        ...parseList(env.TRUSTED_ORIGINS),
        ...getAdditionalDeploymentOrigins(),
        ...getCloudflarePreviewOrigins(env.CLOUDFLARE_WORKER_NAME),
      ].map(normalizeOrigin)
    )
  )
}

export function getBetterAuthAllowedHosts() {
  const env = getEnv()
  return Array.from(
    new Set([
      ...getTrustedOrigins().map(hostnameFromOriginPattern),
      ...getLoopbackHosts(env.SITE_URL),
      ...getPortlessHosts(env.SITE_URL),
      ...parseList(env.TRUSTED_HOSTS).map(normalizeHostPattern),
    ])
  )
}

function patternToRegex(pattern: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`)
}

export function isTrustedOrigin(origin: string | undefined) {
  if (!origin) return false
  const normalizedOrigin = normalizeOrigin(origin)
  return getTrustedOrigins().some((trustedOrigin) => {
    const normalizedTrustedOrigin = normalizeOrigin(trustedOrigin)
    return normalizedTrustedOrigin.includes("*")
      ? patternToRegex(normalizedTrustedOrigin).test(normalizedOrigin)
      : normalizedTrustedOrigin === normalizedOrigin
  })
}

export function getTrustedForwardedAuthOrigin(request: Request | undefined) {
  if (!request) return null

  const forwardedHost = request.headers.get("x-better-auth-forwarded-host")
  const forwardedProto = request.headers.get("x-better-auth-forwarded-proto")

  if (!forwardedHost || !forwardedProto) return null

  const protocol = forwardedProto.replace(/:$/, "")
  if (protocol !== "http" && protocol !== "https") return null

  const host = forwardedHost.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  if (!isTrustedOrigin(`${protocol}://${host}`)) return null

  return { host, protocol }
}
