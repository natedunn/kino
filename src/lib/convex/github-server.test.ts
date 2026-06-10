import { describe, expect, it } from "vitest"

import { cloneGitHubProxyRequestHeaders } from "./github-server"

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
})
