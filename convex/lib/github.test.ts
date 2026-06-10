import { createHmac } from "node:crypto"
import { afterEach, describe, expect, it } from "vitest"
import {
  createGitHubAppState,
  getGitHubCallbackTargetUrl,
  githubAppInstallationUrl,
  privateKeyToDer,
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

function setGitHubAppEnv() {
  resetEnv({
    GITHUB_APP_CLIENT_ID: "client_id",
    GITHUB_APP_CLIENT_SECRET: "client_secret",
    GITHUB_APP_ID: "123",
    GITHUB_APP_PRIVATE_KEY: "private-key",
    GITHUB_APP_SLUG: "kino-test",
    GITHUB_APP_STATE_SECRET: "state-secret",
    GITHUB_APP_WEBHOOK_SECRET: "webhook-secret",
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

  it("hashes state values with sha256 hex", async () => {
    await expect(sha256Hex("kino")).resolves.toBe(
      "ddcd2b747d1b6983fa3314509013b8c20ba4bb250e31d511ea6c342dd898fc2f"
    )
  })

  it("builds the GitHub App installation URL with encoded state", () => {
    setGitHubAppEnv()

    expect(githubAppInstallationUrl("state with spaces")).toBe(
      "https://github.com/apps/kino-test/installations/new?state=state%20with%20spaces"
    )
  })

  it("creates and verifies signed callback state", async () => {
    setGitHubAppEnv()

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
    setGitHubAppEnv()

    await expect(
      createGitHubAppState({
        exp: Date.now() + 60_000,
        nonce: "nonce-123",
        targetUrl: "https://evil.example.com/api/github/callback",
      })
    ).rejects.toThrow("GitHub callback target URL is not trusted")
  })

  it("uses explicit GitHub callback target URL when configured", () => {
    setGitHubAppEnv()
    process.env.GITHUB_APP_CALLBACK_TARGET_URL =
      "https://local.kino.localhost:1355/api/github/callback"

    expect(getGitHubCallbackTargetUrl()).toBe(
      "https://local.kino.localhost:1355/api/github/callback"
    )
  })

  it("verifies GitHub webhook signatures", async () => {
    setGitHubAppEnv()
    const body = JSON.stringify({ action: "opened" })
    const signature = `sha256=${createHmac("sha256", "webhook-secret")
      .update(body)
      .digest("hex")}`

    await expect(
      verifyGitHubWebhookSignature({ body, signature })
    ).resolves.toBe(true)
    await expect(
      verifyGitHubWebhookSignature({ body, signature: "sha256=bad" })
    ).resolves.toBe(false)
    await expect(
      verifyGitHubWebhookSignature({ body, signature: undefined })
    ).resolves.toBe(false)
  })
})
