export type GatewayEnv = {
  TARGETS: KVNamespace

  GATEWAY_ORIGIN: string
  TRUSTED_TARGET_PATTERNS: string

  OAUTH_PROXY_SECRET: string
  BETTER_AUTH_SECRET?: string
  GITHUB_AUTH_CLIENT_ID: string
  GITHUB_AUTH_CLIENT_SECRET: string
  GITHUB_RELAY_STATE_SECRET: string
  GITHUB_RELAY_WEBHOOK_SECRET: string
  GATEWAY_ADMIN_TOKEN: string
}

function patternToRegex(pattern: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`)
}

function normalizeOrigin(origin: string) {
  return origin.endsWith("/") ? origin.slice(0, -1) : origin
}

export function getTrustedTargetPatterns(env: GatewayEnv) {
  return env.TRUSTED_TARGET_PATTERNS.split(",")
    .map((pattern) => normalizeOrigin(pattern.trim()))
    .filter(Boolean)
}

export function isTrustedTargetOrigin(env: GatewayEnv, origin: string) {
  const normalized = normalizeOrigin(origin)
  return getTrustedTargetPatterns(env).some((pattern) =>
    pattern.includes("*")
      ? patternToRegex(pattern).test(normalized)
      : pattern === normalized
  )
}

export function isTrustedTargetUrl(env: GatewayEnv, url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false
    }
    return isTrustedTargetOrigin(env, `${parsed.protocol}//${parsed.host}`)
  } catch {
    return false
  }
}

export function isAuthorizedAdmin(env: GatewayEnv, request: Request) {
  const header = request.headers.get("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!token || !env.GATEWAY_ADMIN_TOKEN) return false
  return timingSafeEqualString(token, env.GATEWAY_ADMIN_TOKEN)
}

export function timingSafeEqualString(left: string, right: string) {
  const encoder = new TextEncoder()
  const a = encoder.encode(left)
  const b = encoder.encode(right)
  if (a.byteLength !== b.byteLength) return false
  let result = 0
  for (let index = 0; index < a.byteLength; index++) {
    result |= a[index]! ^ b[index]!
  }
  return result === 0
}
