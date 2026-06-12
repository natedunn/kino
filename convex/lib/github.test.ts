import { afterEach, describe, expect, it } from "vitest"
import {
  createGitHubAppState,
  getGitHubCallbackTargetUrl,
  githubAppInstallationUrl,
  githubAppUserAuthorizationUrl,
  privateKeyToDer,
  resolveGitHubCallbackTargetUrl,
  sanitizeGitHubInstallationDetails,
  sanitizeGitHubRepository,
  sha256Hex,
  verifyGitHubAppState,
  verifyGitHubWebhookSignature,
} from "./github"

const ORIGINAL_ENV = { ...process.env }

function resetEnv(overrides: Record<string, string | undefined>) {
  for (const key of Object.keys(process.env)) {
    delete process.env[key]
  }

  Object.assign(process.env, ORIGINAL_ENV, overrides)
}

function setGitHubRelayEnv() {
  resetEnv({
    GITHUB_RELAY_CLIENT_ID: "client_id",
    GITHUB_RELAY_CLIENT_SECRET: "client_secret",
    GITHUB_RELAY_APP_ID: "123",
    GITHUB_RELAY_PRIVATE_KEY: "private-key",
    GITHUB_RELAY_SLUG: "kino-test",
    GITHUB_RELAY_STATE_SECRET: "state-secret",
    GITHUB_RELAY_WEBHOOK_SECRET: "webhook-secret",
    SITE_URL: "https://usekino.com",
  })
}

afterEach(() => {
  resetEnv({})
})

describe("github helpers", () => {
  it("parses GitHub App private keys with RSA and PKCS#8 PEM wrappers", () => {
    const base64Der = "AQIDBA=="

    const rsaWrapped = Array.from(
      new Uint8Array(
        privateKeyToDer(
          `-----BEGIN RSA PRIVATE KEY-----\n${base64Der}\n-----END RSA PRIVATE KEY-----`
        )
      )
    )

    expect(rsaWrapped).toEqual([
      0x30, 0x18, 0x02, 0x01, 0x00, 0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48,
      0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00, 0x04, 0x04, 0x01, 0x02,
      0x03, 0x04,
    ])

    expect(
      Array.from(
        new Uint8Array(
          privateKeyToDer(
            `-----BEGIN PRIVATE KEY-----\n${base64Der}\n-----END PRIVATE KEY-----`
          )
        )
      )
    ).toEqual([1, 2, 3, 4])
  })

  it("strips extra GitHub installation fields before cRPC validation", () => {
    expect(
      sanitizeGitHubInstallationDetails({
        account: {
          avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
          id: 1,
          login: "natedunn",
          type: "User",
        } as any,
        events: ["issues"],
        id: 123,
        permissions: { issues: "write", metadata: "read" },
        repository_selection: "selected",
        target_type: "User",
      } as any)
    ).toEqual({
      account: {
        id: 1,
        login: "natedunn",
        type: "User",
      },
      events: ["issues"],
      id: 123,
      permissions: { issues: "write", metadata: "read" },
      repository_selection: "selected",
    })
  })

  it("strips extra GitHub repository fields before cRPC validation", () => {
    expect(
      sanitizeGitHubRepository({
        full_name: "natedunn/kino",
        html_url: "https://github.com/natedunn/kino",
        id: 456,
        name: "kino",
        node_id: "R_kgDOTest",
        owner: {
          avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
          login: "natedunn",
        },
        private: true,
      } as any)
    ).toEqual({
      full_name: "natedunn/kino",
      id: 456,
      name: "kino",
      node_id: "R_kgDOTest",
      owner: {
        login: "natedunn",
      },
      private: true,
    })
  })

  it("hashes state values with sha256 hex", async () => {
    await expect(sha256Hex("kino")).resolves.toBe(
      "ddcd2b747d1b6983fa3314509013b8c20ba4bb250e31d511ea6c342dd898fc2f"
    )
  })

  it("builds the GitHub App installation URL with encoded state", () => {
    setGitHubRelayEnv()

    expect(githubAppInstallationUrl("state with spaces")).toBe(
      "https://github.com/apps/kino-test/installations/new?state=state%20with%20spaces"
    )
  })

  it("builds the GitHub App user authorization URL with encoded state", () => {
    setGitHubRelayEnv()

    expect(githubAppUserAuthorizationUrl("state with spaces")).toBe(
      "https://github.com/login/oauth/authorize?client_id=client_id&state=state+with+spaces"
    )
  })

  it("creates and verifies signed callback state", async () => {
    setGitHubRelayEnv()

    const state = await createGitHubAppState({
      exp: Date.now() + 60_000,
      nonce: "nonce-123",
      targetUrl: "https://preview-kino.hello-fc8.workers.dev/api/github/callback",
    })

    await expect(verifyGitHubAppState(state)).resolves.toMatchObject({
      nonce: "nonce-123",
      targetUrl: "https://preview-kino.hello-fc8.workers.dev/api/github/callback",
      v: 1,
    })
    await expect(verifyGitHubAppState(`${state}tampered`)).rejects.toThrow(
      "GitHub state signature is invalid"
    )
  })

  it("rejects untrusted callback targets", async () => {
    setGitHubRelayEnv()

    await expect(
      createGitHubAppState({
        exp: Date.now() + 60_000,
        nonce: "nonce-123",
        targetUrl: "https://evil.example.com/api/github/callback",
      })
    ).rejects.toThrow("GitHub callback target URL is not trusted")
  })

  it("uses explicit GitHub callback target URL when configured", () => {
    setGitHubRelayEnv()
    process.env.GITHUB_RELAY_CALLBACK_TARGET_URL =
      "https://local.kino.localhost:1355/api/github/callback"

    expect(getGitHubCallbackTargetUrl()).toBe(
      "https://local.kino.localhost:1355/api/github/callback"
    )
  })

  it("uses a trusted requested callback target URL when no override is configured", () => {
    setGitHubRelayEnv()

    expect(
      resolveGitHubCallbackTargetUrl(
        "https://mizar.kino.localhost:1355/api/github/callback"
      )
    ).toBe("https://mizar.kino.localhost:1355/api/github/callback")
  })

  it("keeps the explicit callback target override ahead of requested targets", () => {
    setGitHubRelayEnv()
    process.env.GITHUB_RELAY_CALLBACK_TARGET_URL =
      "https://brainy-boar-871.convex.site/api/github/callback"
    process.env.TRUSTED_ORIGINS = "https://brainy-boar-871.convex.site"

    expect(
      resolveGitHubCallbackTargetUrl(
        "https://mizar.kino.localhost:1355/api/github/callback"
      )
    ).toBe("https://brainy-boar-871.convex.site/api/github/callback")
  })

  it("rejects untrusted requested callback targets", () => {
    setGitHubRelayEnv()

    expect(() =>
      resolveGitHubCallbackTargetUrl(
        "https://evil.example.com/api/github/callback"
      )
    ).toThrow("GitHub callback target URL is not trusted")
  })
})

describe("verifyGitHubWebhookSignature", () => {
  // echo -n '{"action":"ping"}' | openssl dgst -sha256 -hmac webhook-secret
  const BODY = '{"action":"ping"}'
  const VALID_SIG =
    "sha256=b79f7f179b41184d008131377978dead58052349a984dd3e0352c64488989813"

  it("accepts a valid signature", async () => {
    setGitHubRelayEnv()
    expect(await verifyGitHubWebhookSignature(BODY, VALID_SIG)).toBe(true)
  })

  it("rejects a tampered body", async () => {
    setGitHubRelayEnv()
    expect(
      await verifyGitHubWebhookSignature('{"action":"pong"}', VALID_SIG)
    ).toBe(false)
  })

  it("rejects a wrong signature of the right length", async () => {
    setGitHubRelayEnv()
    const wrong = `sha256=${"0".repeat(64)}`
    expect(await verifyGitHubWebhookSignature(BODY, wrong)).toBe(false)
  })

  it("rejects missing or unprefixed signature headers", async () => {
    setGitHubRelayEnv()
    expect(await verifyGitHubWebhookSignature(BODY, null)).toBe(false)
    expect(await verifyGitHubWebhookSignature(BODY, undefined)).toBe(false)
    expect(
      await verifyGitHubWebhookSignature(BODY, VALID_SIG.replace("sha256=", ""))
    ).toBe(false)
    expect(
      await verifyGitHubWebhookSignature(BODY, VALID_SIG.replace("sha256=", "sha1="))
    ).toBe(false)
  })

  it("verifies with only the webhook secret configured", async () => {
    // Receipt must not depend on unrelated GITHUB_RELAY_* vars (private key etc.)
    resetEnv({ GITHUB_RELAY_WEBHOOK_SECRET: "webhook-secret" })
    expect(await verifyGitHubWebhookSignature(BODY, VALID_SIG)).toBe(true)
  })

  it("throws when the webhook secret is not configured", async () => {
    resetEnv({})
    await expect(verifyGitHubWebhookSignature(BODY, VALID_SIG)).rejects.toThrow(
      "GITHUB_RELAY_WEBHOOK_SECRET"
    )
  })
})
