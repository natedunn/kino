import { afterEach, describe, expect, it } from "vitest"

import {
  getBetterAuthAllowedHosts,
  getOAuthProxyCurrentUrlEnv,
  getOAuthProxyProductionUrlEnv,
  getTrustedForwardedAuthOrigin,
  getTrustedOrigins,
  isTrustedOrigin,
} from "./get-env"

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

describe("trusted auth origins", () => {
  it("includes configured site, deployment urls, and Cloudflare preview patterns", () => {
    resetEnv({
      CF_PAGES_URL: "https://kino-preview.pages.dev",
      CLOUDFLARE_WORKER_NAME: "kino",
      SITE_URL: "https://usekino.com",
      TRUSTED_ORIGINS: "https://staging.usekino.com",
    })

    expect(getTrustedOrigins()).toEqual([
      "https://usekino.com",
      "https://staging.usekino.com",
      "https://kino-preview.pages.dev",
      "https://kino.*.workers.dev",
      "https://*-kino.*.workers.dev",
    ])
  })

  it("derives allowed hosts from trusted origins and explicit host patterns", () => {
    resetEnv({
      CLOUDFLARE_WORKER_NAME: "kino",
      SITE_URL: "https://usekino.com",
      TRUSTED_HOSTS: "*.internal.usekino.dev",
    })

    expect(getBetterAuthAllowedHosts()).toEqual([
      "usekino.com",
      "kino.*.workers.dev",
      "*-kino.*.workers.dev",
      "*.internal.usekino.dev",
    ])
  })

  it("matches preview origins against wildcard patterns", () => {
    resetEnv({
      CLOUDFLARE_WORKER_NAME: "kino",
      SITE_URL: "https://usekino.com",
    })

    expect(
      isTrustedOrigin("https://feature-kino.team-subdomain.workers.dev")
    ).toBe(true)
    expect(
      isTrustedOrigin("https://other-app.team-subdomain.workers.dev")
    ).toBe(false)
  })

  it("allows loopback origins on any port when the site url is local development", () => {
    resetEnv({
      SITE_URL: "http://localhost:3000",
    })

    expect(getTrustedOrigins()).toEqual([
      "http://localhost:3000",
      "http://localhost:*",
      "http://127.0.0.1:*",
      "http://[::1]:*",
      "https://*.localhost",
      "https://*.localhost:*",
      "http://*.localhost",
      "http://*.localhost:*",
      "https://kino.*.workers.dev",
      "https://*-kino.*.workers.dev",
    ])
    expect(getBetterAuthAllowedHosts()).toEqual([
      "localhost:3000",
      "localhost:*",
      "127.0.0.1:*",
      "[::1]:*",
      "*.localhost",
      "*.localhost:*",
      "kino.*.workers.dev",
      "*-kino.*.workers.dev",
    ])
    expect(isTrustedOrigin("http://localhost:3001/auth")).toBe(true)
    expect(isTrustedOrigin("http://127.0.0.1:5173/auth")).toBe(true)
    expect(isTrustedOrigin("https://rasalhague.kino.localhost")).toBe(true)
    expect(isTrustedOrigin("http://rasalhague.kino.localhost:1355")).toBe(true)
  })

  it("keeps OAuth proxy current and production URLs independently configurable", () => {
    resetEnv({
      OAUTH_PROXY_CURRENT_URL: "https://feature-kino.hello-fc8.workers.dev",
      OAUTH_PROXY_PRODUCTION_URL: "https://usekino.com",
      SITE_URL: "https://usekino.com",
    })

    expect(getOAuthProxyCurrentUrlEnv()).toBe(
      "https://feature-kino.hello-fc8.workers.dev"
    )
    expect(getOAuthProxyProductionUrlEnv()).toBe("https://usekino.com")
  })

  it("extracts trusted forwarded auth origins for Better Auth base URL resolution", () => {
    resetEnv({
      SITE_URL: "http://localhost:3000",
    })

    expect(
      getTrustedForwardedAuthOrigin(
        new Request(
          "https://scrupulous-lemming-700.convex.site/api/auth/sign-in/social",
          {
            headers: {
              "x-better-auth-forwarded-host":
                "local-dev-portless-worktrees.kino.localhost:1355",
              "x-better-auth-forwarded-proto": "https",
            },
          }
        )
      )
    ).toEqual({
      host: "local-dev-portless-worktrees.kino.localhost:1355",
      protocol: "https",
    })
  })
})
