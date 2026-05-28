import { describe, expect, it } from "vitest"

import { getSafeRedirectTarget } from "./auth"

describe("getSafeRedirectTarget", () => {
  it("defaults to the dashboard when redirect is missing", () => {
    expect(getSafeRedirectTarget(undefined)).toBe("/dashboard")
  })

  it("avoids redirecting back to the auth page after login", () => {
    expect(getSafeRedirectTarget("/auth")).toBe("/dashboard")
    expect(getSafeRedirectTarget("/auth?redirect=%2Fauth")).toBe("/dashboard")
  })

  it("avoids redirecting back to the public landing page after login", () => {
    expect(getSafeRedirectTarget("/")).toBe("/dashboard")
  })

  it("preserves safe in-app redirect paths", () => {
    expect(getSafeRedirectTarget("/acme")).toBe("/acme")
    expect(getSafeRedirectTarget("/acme/project?tab=updates#latest")).toBe(
      "/acme/project?tab=updates#latest"
    )
  })
})
