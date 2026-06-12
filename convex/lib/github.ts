import { CRPCError } from "kitcn/server"
import { getEnv, getGitHubRelayEnv, isTrustedOrigin } from "./get-env"

const GITHUB_API_URL = "https://api.github.com"
const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql"
const GITHUB_OAUTH_ACCESS_TOKEN_URL =
  "https://github.com/login/oauth/access_token"
const GITHUB_OAUTH_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"

type GitHubRelayEnv = {
  appId: string
  callbackTargetUrl?: string
  clientId: string
  clientSecret: string
  privateKey: string
  slug: string
  stateSecret: string
  webhookSecret: string
}

export type GitHubAppStatePayload = {
  exp: number
  nonce: string
  targetUrl: string
  v: 1
}

export type GitHubInstallationDetails = {
  id: number
  account: {
    id: number
    login: string
    type: string
  } | null
  events: string[]
  permissions: Record<string, string>
  repository_selection: string
}

export type GitHubRepository = {
  id: number
  node_id: string
  name: string
  full_name: string
  private: boolean
  owner: {
    login: string
  }
}

export type GitHubRepositoryProbe = {
  discussions: {
    enabled: boolean
    ok: boolean
  }
  issues: {
    ok: boolean
  }
  repository: GitHubRepository
}

export function sanitizeGitHubInstallationDetails(
  installation: GitHubInstallationDetails
): GitHubInstallationDetails {
  return {
    account: installation.account
      ? {
          id: installation.account.id,
          login: installation.account.login,
          type: installation.account.type,
        }
      : null,
    events: installation.events,
    id: installation.id,
    permissions: installation.permissions,
    repository_selection: installation.repository_selection,
  }
}

export function sanitizeGitHubRepository(
  repository: GitHubRepository
): GitHubRepository {
  return {
    full_name: repository.full_name,
    id: repository.id,
    name: repository.name,
    node_id: repository.node_id,
    owner: {
      login: repository.owner.login,
    },
    private: repository.private,
  }
}

function assertString(value: string | undefined, name: string) {
  if (!value) {
    throw new CRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `${name} is not configured`,
    })
  }
  return value
}

export function getRequiredGitHubRelayEnv(): GitHubRelayEnv {
  const env = getGitHubRelayEnv()
  return {
    appId: assertString(env.appId, "GITHUB_RELAY_APP_ID"),
    callbackTargetUrl: env.callbackTargetUrl,
    clientId: assertString(env.clientId, "GITHUB_RELAY_CLIENT_ID"),
    clientSecret: assertString(env.clientSecret, "GITHUB_RELAY_CLIENT_SECRET"),
    privateKey: assertString(env.privateKey, "GITHUB_RELAY_PRIVATE_KEY"),
    slug: assertString(env.slug, "GITHUB_RELAY_SLUG"),
    stateSecret: env.stateSecret ?? assertString(
      env.webhookSecret,
      "GITHUB_RELAY_WEBHOOK_SECRET"
    ),
    webhookSecret: assertString(
      env.webhookSecret,
      "GITHUB_RELAY_WEBHOOK_SECRET"
    ),
  }
}

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array | string) {
  const binary =
    typeof bytes === "string"
      ? bytes
      : String.fromCharCode(...new Uint8Array(bytes))
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function base64UrlDecode(value: string) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new TextDecoder().decode(bytes)
}

function normalizePrivateKey(privateKey: string) {
  return privateKey.replace(/\\n/g, "\n").trim()
}

function decodeBase64Der(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function derLength(length: number) {
  if (length < 0x80) return [length]

  const bytes: number[] = []
  let remaining = length
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff)
    remaining >>= 8
  }
  return [0x80 | bytes.length, ...bytes]
}

function derSequence(...parts: Uint8Array[]) {
  const length = parts.reduce((total, part) => total + part.length, 0)
  const bytes = new Uint8Array(1 + derLength(length).length + length)
  let offset = 0
  bytes[offset++] = 0x30
  for (const byte of derLength(length)) {
    bytes[offset++] = byte
  }
  for (const part of parts) {
    bytes.set(part, offset)
    offset += part.length
  }
  return bytes
}

function derOctetString(value: Uint8Array) {
  const length = derLength(value.length)
  const bytes = new Uint8Array(1 + length.length + value.length)
  bytes[0] = 0x04
  bytes.set(length, 1)
  bytes.set(value, 1 + length.length)
  return bytes
}

function rsaPrivateKeyToPkcs8Der(rsaPrivateKeyDer: Uint8Array) {
  const version = new Uint8Array([0x02, 0x01, 0x00])
  const rsaEncryptionAlgorithmIdentifier = new Uint8Array([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01,
    0x01, 0x05, 0x00,
  ])

  return derSequence(
    version,
    rsaEncryptionAlgorithmIdentifier,
    derOctetString(rsaPrivateKeyDer)
  )
}

export function privateKeyToDer(privateKey: string) {
  const normalized = normalizePrivateKey(privateKey)
  const isPkcs1Rsa = normalized.includes("-----BEGIN RSA PRIVATE KEY-----")
  const pem = normalized
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/, "")
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/, "")
    .replace(/\s/g, "")
  const bytes = decodeBase64Der(pem)
  return (isPkcs1Rsa ? rsaPrivateKeyToPkcs8Der(bytes) : bytes).buffer
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  )
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

async function hmacSha256Hex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  )
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let result = 0
  for (let index = 0; index < left.length; index++) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return result === 0
}

export async function verifyGitHubWebhookSignature(
  body: string,
  signatureHeader: string | null | undefined
) {
  if (!signatureHeader?.startsWith("sha256=")) return false

  const env = getRequiredGitHubRelayEnv()
  const expected = `sha256=${await hmacSha256Hex(env.webhookSecret, body)}`
  return constantTimeEqual(expected, signatureHeader)
}

export function getGitHubCallbackTargetUrl() {
  const env = getRequiredGitHubRelayEnv()
  if (env.callbackTargetUrl) {
    return env.callbackTargetUrl
  }

  const siteUrl = getEnv().SITE_URL.replace(/\/$/, "")
  return `${siteUrl}/api/github/callback`
}

export function resolveGitHubCallbackTargetUrl(requestedTargetUrl?: string) {
  const env = getRequiredGitHubRelayEnv()
  const targetUrl =
    env.callbackTargetUrl ?? requestedTargetUrl ?? getGitHubCallbackTargetUrl()
  if (!isTrustedGitHubCallbackTarget(targetUrl)) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "GitHub callback target URL is not trusted",
    })
  }
  return targetUrl
}

export function isTrustedGitHubCallbackTarget(targetUrl: string) {
  try {
    const target = new URL(targetUrl)
    const hostname = target.hostname.toLowerCase()
    const origin = `${target.protocol}//${target.host}`

    if (target.pathname !== "/api/github/callback") return false
    if (target.protocol !== "https:" && target.protocol !== "http:") return false

    return (
      hostname === "usekino.com" ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".localhost") ||
      hostname === "kino.hello-fc8.workers.dev" ||
      hostname.endsWith("-kino.hello-fc8.workers.dev") ||
      isTrustedOrigin(origin)
    )
  } catch {
    return false
  }
}

export async function createGitHubAppState(
  payload: Omit<GitHubAppStatePayload, "v">
) {
  const env = getRequiredGitHubRelayEnv()
  const fullPayload: GitHubAppStatePayload = { ...payload, v: 1 }
  if (!isTrustedGitHubCallbackTarget(fullPayload.targetUrl)) {
    throw new CRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "GitHub callback target URL is not trusted",
    })
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload))
  const signature = await hmacSha256Hex(env.stateSecret, encodedPayload)
  return `${encodedPayload}.${signature}`
}

export async function verifyGitHubAppState(state: string) {
  const env = getRequiredGitHubRelayEnv()
  const [encodedPayload, signature] = state.split(".")
  if (!encodedPayload || !signature) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "GitHub state is malformed",
    })
  }

  const expectedSignature = await hmacSha256Hex(env.stateSecret, encodedPayload)
  if (!constantTimeEqual(expectedSignature, signature)) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "GitHub state signature is invalid",
    })
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<GitHubAppStatePayload>
  if (
    payload.v !== 1 ||
    typeof payload.exp !== "number" ||
    typeof payload.nonce !== "string" ||
    typeof payload.targetUrl !== "string"
  ) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "GitHub state payload is invalid",
    })
  }
  if (payload.exp < Date.now()) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "GitHub state expired",
    })
  }
  if (!isTrustedGitHubCallbackTarget(payload.targetUrl)) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "GitHub callback target URL is not trusted",
    })
  }

  return payload as GitHubAppStatePayload
}

export async function verifyGitHubAppStateForCurrentTarget(state: string) {
  return await verifyGitHubAppState(state)
}

export async function createGitHubAppJwt() {
  const env = getRequiredGitHubRelayEnv()
  const nowSeconds = Math.floor(Date.now() / 1000)
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const payload = base64UrlEncode(
    JSON.stringify({
      iat: nowSeconds - 60,
      exp: nowSeconds + 9 * 60,
      iss: env.appId,
    })
  )
  const signingInput = `${header}.${payload}`
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyToDer(env.privateKey),
    { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  )
  return `${signingInput}.${base64UrlEncode(signature)}`
}

async function githubFetch<T>(
  url: string,
  init: RequestInit & { token?: string }
) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "kino-github-integration",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...init.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new CRPCError({
      code: response.status === 404 ? "NOT_FOUND" : "BAD_REQUEST",
      message: `GitHub request failed (${response.status}): ${body.slice(0, 300)}`,
    })
  }

  return (await response.json()) as T
}

export async function exchangeGitHubSetupCode(code: string) {
  const env = getRequiredGitHubRelayEnv()
  const result = await githubFetch<{ access_token?: string; error?: string }>(
    GITHUB_OAUTH_ACCESS_TOKEN_URL,
    {
      body: JSON.stringify({
        client_id: env.clientId,
        client_secret: env.clientSecret,
        code,
      }),
      method: "POST",
    }
  )
  if (!result.access_token) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: result.error ?? "GitHub did not return an access token",
    })
  }
  return result.access_token
}

export async function listUserInstallations(userToken: string) {
  const result = await githubFetch<{ installations: GitHubInstallationDetails[] }>(
    `${GITHUB_API_URL}/user/installations?per_page=100`,
    { method: "GET", token: userToken }
  )
  return result.installations
}

export async function getAppInstallation(installationId: number) {
  const jwt = await createGitHubAppJwt()
  return await githubFetch<GitHubInstallationDetails>(
    `${GITHUB_API_URL}/app/installations/${installationId}`,
    { method: "GET", token: jwt }
  )
}

export async function createInstallationToken(args: {
  installationId: number
  mode: "read" | "read_write"
  repositoryIds?: number[]
}) {
  const jwt = await createGitHubAppJwt()
  const permissions =
    args.mode === "read"
      ? { discussions: "read", issues: "read", metadata: "read" }
      : { discussions: "write", issues: "write", metadata: "read" }

  const result = await githubFetch<{ token: string; expires_at: string }>(
    `${GITHUB_API_URL}/app/installations/${args.installationId}/access_tokens`,
    {
      body: JSON.stringify({
        permissions,
        ...(args.repositoryIds ? { repository_ids: args.repositoryIds } : {}),
      }),
      method: "POST",
      token: jwt,
    }
  )
  return result
}

export async function listInstallationRepositories(token: string) {
  const result = await githubFetch<{ repositories: GitHubRepository[] }>(
    `${GITHUB_API_URL}/installation/repositories?per_page=100`,
    { method: "GET", token }
  )
  return result.repositories
}

async function graphql<T>(token: string, query: string, variables: unknown) {
  const result = await githubFetch<{ data?: T; errors?: Array<{ message: string }> }>(
    GITHUB_GRAPHQL_URL,
    {
      body: JSON.stringify({ query, variables }),
      method: "POST",
      token,
    }
  )
  if (result.errors?.length) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: result.errors.map((error) => error.message).join("; "),
    })
  }
  if (!result.data) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "GitHub GraphQL did not return data",
    })
  }
  return result.data
}

export async function probeRepository(args: {
  mode: "read" | "read_write"
  repository: GitHubRepository
  token: string
}) {
  const [owner, name] = args.repository.full_name.split("/")
  await githubFetch<unknown>(
    `${GITHUB_API_URL}/repos/${owner}/${name}/issues?state=all&per_page=1`,
    { method: "GET", token: args.token }
  )

  const data = await graphql<{
    repository: {
      hasDiscussionsEnabled: boolean
    } | null
  }>(
    args.token,
    `query KinoRepositoryProbe($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        hasDiscussionsEnabled
        discussionCategories(first: 1) {
          nodes { id name }
        }
        discussions(first: 1) {
          nodes { id number title updatedAt }
        }
      }
    }`,
    { name, owner }
  )

  if (!data.repository) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "GitHub repository not found",
    })
  }

  return {
    discussions: {
      enabled: data.repository.hasDiscussionsEnabled,
      ok: true,
    },
    issues: {
      ok: true,
    },
    repository: args.repository,
  } satisfies GitHubRepositoryProbe
}

export function githubAppInstallationUrl(state: string) {
  const env = getRequiredGitHubRelayEnv()
  return `https://github.com/apps/${env.slug}/installations/new?state=${encodeURIComponent(state)}`
}

export function githubAppUserAuthorizationUrl(state: string) {
  const env = getRequiredGitHubRelayEnv()
  const url = new URL(GITHUB_OAUTH_AUTHORIZE_URL)
  url.searchParams.set("client_id", env.clientId)
  url.searchParams.set("state", state)
  return url.toString()
}
