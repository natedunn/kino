import { afterEach, describe, expect, it } from "vitest"

import {
  defaultOAuthProxyProductionUrl,
  forwardedAuthRequestContext,
  forwardedAuthRequestUrl,
} from "./auth"

const ORIGINAL_ENV = { ...process.env }

function resetEnv(overrides: Record<string, string | undefined>) {
  for (const key of Object.keys(process.env)) {
    delete process.env[key]
  }

  Object.assign(process.env, ORIGINAL_ENV, overrides)
}

afterEach(() => {
  resetEnv({})
})

describe("forwardedAuthRequestUrl", () => {
  it("uses trusted preview worker hosts for OAuth sign-in requests", () => {
    resetEnv({
      CLOUDFLARE_WORKER_NAME: "kino",
      SITE_URL: "https://usekino.com",
    })

    const request = new Request(
      "https://scrupulous-lemming-700.convex.site/api/auth/sign-in/social",
      {
        headers: {
          "x-better-auth-forwarded-host":
            "feature-kino.team-subdomain.workers.dev",
          "x-better-auth-forwarded-proto": "https",
        },
      }
    )

    expect(forwardedAuthRequestUrl(request)).toBe(
      "https://feature-kino.team-subdomain.workers.dev/api/auth/sign-in/social"
    )
  })

  it("allows loopback forwarded hosts during local development", () => {
    resetEnv({
      SITE_URL: "http://localhost:3000",
    })

    const request = new Request(
      "https://scrupulous-lemming-700.convex.site/api/auth/sign-in/social?callbackURL=http://localhost:3000/auth",
      {
        headers: {
          "x-better-auth-forwarded-host": "127.0.0.1:5173",
          "x-better-auth-forwarded-proto": "http",
        },
      }
    )

    expect(forwardedAuthRequestUrl(request)).toBe(
      "http://127.0.0.1:5173/api/auth/sign-in/social?callbackURL=http://localhost:3000/auth"
    )
  })

  it("allows Portless forwarded hosts during local development", () => {
    resetEnv({
      SITE_URL: "http://localhost:3000",
    })

    const request = new Request(
      "https://scrupulous-lemming-700.convex.site/api/auth/sign-in/social?callbackURL=https://rasalhague.kino.localhost/auth",
      {
        headers: {
          "x-better-auth-forwarded-host": "rasalhague.kino.localhost",
          "x-better-auth-forwarded-proto": "https",
        },
      }
    )

    expect(forwardedAuthRequestUrl(request)).toBe(
      "https://rasalhague.kino.localhost/api/auth/sign-in/social?callbackURL=https://rasalhague.kino.localhost/auth"
    )
  })

  it("allows Portless forwarded hosts on a custom proxy port during local development", () => {
    resetEnv({
      SITE_URL: "http://localhost:3000",
    })

    const request = new Request(
      "https://scrupulous-lemming-700.convex.site/api/auth/sign-in/social?callbackURL=http://rasalhague.kino.localhost:1355/auth",
      {
        headers: {
          "x-better-auth-forwarded-host": "rasalhague.kino.localhost:1355",
          "x-better-auth-forwarded-proto": "http",
        },
      }
    )

    expect(forwardedAuthRequestUrl(request)).toBe(
      "http://rasalhague.kino.localhost:1355/api/auth/sign-in/social?callbackURL=http://rasalhague.kino.localhost:1355/auth"
    )
  })

  it("ignores untrusted forwarded hosts", () => {
    resetEnv({
      CLOUDFLARE_WORKER_NAME: "kino",
      SITE_URL: "https://usekino.com",
    })

    const request = new Request(
      "https://scrupulous-lemming-700.convex.site/api/auth/sign-in/social",
      {
        headers: {
          "x-better-auth-forwarded-host": "attacker.example.com",
          "x-better-auth-forwarded-proto": "https",
        },
      }
    )

    expect(forwardedAuthRequestUrl(request)).toBeNull()
  })
})

describe("forwardedAuthRequestContext", () => {
  it("returns a Better Auth hook context patch with the forwarded request", () => {
    resetEnv({
      CLOUDFLARE_WORKER_NAME: "kino",
      SITE_URL: "https://usekino.com",
    })

    const request = new Request(
      "https://scrupulous-lemming-700.convex.site/api/auth/sign-in/social",
      {
        headers: {
          "x-better-auth-forwarded-host":
            "preview-auth-oauth-debug-kino.hello-fc8.workers.dev",
          "x-better-auth-forwarded-proto": "https",
        },
        method: "POST",
      }
    )

    const context = forwardedAuthRequestContext(request)

    expect(context?.request.url).toBe(
      "https://preview-auth-oauth-debug-kino.hello-fc8.workers.dev/api/auth/sign-in/social"
    )
    expect(context?.request.method).toBe("POST")
  })
})

describe("defaultOAuthProxyProductionUrl", () => {
  it("uses the production relay for loopback local development", () => {
    expect(
      defaultOAuthProxyProductionUrl({ SITE_URL: "http://localhost:3000" })
    ).toBe("https://usekino.com")
  })

  it("does not force OAuth provider callbacks to non-loopback HTTP sites", () => {
    expect(
      defaultOAuthProxyProductionUrl({ SITE_URL: "http://staging.usekino.com" })
    ).toBeUndefined()
  })

  it("uses the configured site URL outside local development", () => {
    expect(
      defaultOAuthProxyProductionUrl({ SITE_URL: "https://usekino.com" })
    ).toBe("https://usekino.com")
  })
})
