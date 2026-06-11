import { afterEach, describe, expect, it, vi } from "vitest"

import { cloneGitHubProxyRequestHeaders, handler } from "./github-server"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("cloneGitHubProxyRequestHeaders", () => {
  it("preserves GitHub webhook headers but strips origin routing headers", () => {
    const headers = cloneGitHubProxyRequestHeaders(
      new Headers({
        "cf-ray": "test-ray",
        "content-type": "application/json",
        host: "usekino.com",
        "user-agent": "GitHub-Hookshot/test",
        "x-forwarded-host": "usekino.com",
        "x-github-delivery": "delivery-id",
        "x-github-event": "issues",
        "x-hub-signature-256": "sha256=abc",
      })
    )

    expect(headers.get("host")).toBeNull()
    expect(headers.get("cf-ray")).toBeNull()
    expect(headers.get("x-forwarded-host")).toBeNull()
    expect(headers.get("content-type")).toBe("application/json")
    expect(headers.get("user-agent")).toBe("GitHub-Hookshot/test")
    expect(headers.get("x-github-delivery")).toBe("delivery-id")
    expect(headers.get("x-github-event")).toBe("issues")
    expect(headers.get("x-hub-signature-256")).toBe("sha256=abc")
  })

  it("preserves Convex redirects instead of following them inside the proxy", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        return new Response(null, {
          headers: { location: "https://mizar.kino.localhost:1355/dashboard" },
          status: 302,
        })
      }
    )
    vi.stubGlobal("fetch", fetchMock)

    const response = await handler(
      new Request("https://mizar.kino.localhost:1355/api/github/callback")
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]
    expect(init).toMatchObject({
      redirect: "manual",
    })
    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe(
      "https://mizar.kino.localhost:1355/dashboard"
    )
  })
})
