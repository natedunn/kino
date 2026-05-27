import { describe, expect, it } from "vitest"

import {
  cloneHeadersPreservingSetCookie,
  getSetCookieValues,
  rewriteAuthRedirectLocation,
  syncSignInSocialLocationHeader,
} from "./auth-server"

describe("rewriteAuthRedirectLocation", () => {
  it("rewrites convex auth redirects onto the current app origin", () => {
    expect(
      rewriteAuthRedirectLocation({
        convexSiteUrl: "https://scrupulous-lemming-700.convex.site",
        location:
          "https://scrupulous-lemming-700.convex.site/api/auth/oauth-proxy-callback?callbackURL=http%3A%2F%2Flocalhost%3A3000%2F",
        requestUrl: "http://localhost:3000/api/auth/callback/github?code=abc",
      })
    ).toBe(
      "http://localhost:3000/api/auth/oauth-proxy-callback?callbackURL=http%3A%2F%2Flocalhost%3A3000%2F"
    )
  })

  it("leaves non-convex redirects alone", () => {
    expect(
      rewriteAuthRedirectLocation({
        convexSiteUrl: "https://scrupulous-lemming-700.convex.site",
        location: "https://github.com/login/oauth/authorize?state=abc",
        requestUrl: "http://localhost:3000/api/auth/sign-in/social",
      })
    ).toBe("https://github.com/login/oauth/authorize?state=abc")
  })

  it("leaves non-auth convex redirects alone", () => {
    expect(
      rewriteAuthRedirectLocation({
        convexSiteUrl: "https://scrupulous-lemming-700.convex.site",
        location: "https://scrupulous-lemming-700.convex.site/somewhere-else",
        requestUrl: "http://localhost:3000/api/auth/callback/github",
      })
    ).toBe("https://scrupulous-lemming-700.convex.site/somewhere-else")
  })

  it("rewrites cross-deployment OAuth proxy callbacks onto the callback origin", () => {
    expect(
      rewriteAuthRedirectLocation({
        convexSiteUrl: "https://brainy-boar-871.convex.site",
        location:
          "https://gregarious-gerbil-969.convex.site/api/auth/oauth-proxy-callback?callbackURL=https%3A%2F%2Fpreview-auth-oauth-debug-kino.hello-fc8.workers.dev%2Fauth&profile=encrypted-profile",
        requestUrl: "https://usekino.com/api/auth/callback/github?code=abc",
      })
    ).toBe(
      "https://preview-auth-oauth-debug-kino.hello-fc8.workers.dev/api/auth/oauth-proxy-callback?callbackURL=https%3A%2F%2Fpreview-auth-oauth-debug-kino.hello-fc8.workers.dev%2Fauth&profile=encrypted-profile"
    )
  })

  it("does not rewrite OAuth proxy callbacks to untrusted callback origins", () => {
    const location =
      "https://gregarious-gerbil-969.convex.site/api/auth/oauth-proxy-callback?callbackURL=https%3A%2F%2Fevil.example.com%2Fauth&profile=encrypted-profile"

    expect(
      rewriteAuthRedirectLocation({
        convexSiteUrl: "https://brainy-boar-871.convex.site",
        location,
        requestUrl: "https://usekino.com/api/auth/callback/github?code=abc",
      })
    ).toBe(location)
  })
})

describe("cloneHeadersPreservingSetCookie", () => {
  it("preserves each set-cookie header when the runtime exposes getSetCookie", () => {
    const source = new Headers({
      location:
        "https://scrupulous-lemming-700.convex.site/api/auth/oauth-proxy-callback",
      vary: "Origin",
    }) as Headers & { getSetCookie: () => string[] }

    source.getSetCookie = () => [
      "__Secure-better-auth.state=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
      "__Secure-better-auth.session_token=abc; Path=/; HttpOnly; Secure; SameSite=Lax",
    ]

    const cloned = cloneHeadersPreservingSetCookie(source) as Headers & {
      getSetCookie?: () => string[]
    }

    expect(cloned.get("location")).toBe(
      "https://scrupulous-lemming-700.convex.site/api/auth/oauth-proxy-callback"
    )
    expect(cloned.get("vary")).toBe("Origin")

    if (typeof cloned.getSetCookie === "function") {
      expect(cloned.getSetCookie()).toEqual([
        "__Secure-better-auth.state=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
        "__Secure-better-auth.session_token=abc; Path=/; HttpOnly; Secure; SameSite=Lax",
      ])
    } else {
      expect(cloned.get("set-cookie")).toContain(
        "__Secure-better-auth.session_token=abc"
      )
    }
  })

  it("splits collapsed set-cookie headers before forwarding them", () => {
    const source = new Headers({
      "set-cookie":
        "__Secure-better-auth.state=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax, __Secure-better-auth.session_token=abc; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax",
    })

    expect(getSetCookieValues(source)).toEqual([
      "__Secure-better-auth.state=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
      "__Secure-better-auth.session_token=abc; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax",
    ])

    expect(cloneHeadersPreservingSetCookie(source).get("set-cookie")).toContain(
      "__Secure-better-auth.session_token=abc"
    )
  })

  it("splits collapsed getSetCookie values before forwarding them", () => {
    const source = new Headers() as Headers & { getSetCookie: () => string[] }
    source.getSetCookie = () => [
      "__Secure-better-auth.state=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax, __Secure-better-auth.session_token=abc; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax",
    ]

    expect(getSetCookieValues(source)).toEqual([
      "__Secure-better-auth.state=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
      "__Secure-better-auth.session_token=abc; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax",
    ])

    const cloned = cloneHeadersPreservingSetCookie(source) as Headers & {
      getSetCookie?: () => string[]
    }

    if (typeof cloned.getSetCookie === "function") {
      expect(cloned.getSetCookie()).toEqual([
        "__Secure-better-auth.state=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
        "__Secure-better-auth.session_token=abc; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax",
      ])
    } else {
      expect(cloned.get("set-cookie")).toContain(
        "__Secure-better-auth.session_token=abc"
      )
    }
  })
})

describe("syncSignInSocialLocationHeader", () => {
  it("keeps the Location header aligned with the OAuth proxy JSON URL", async () => {
    const request = new Request(
      "https://preview.example.com/api/auth/sign-in/social",
      {
        method: "POST",
      }
    )
    const response = new Response(
      JSON.stringify({
        redirect: true,
        url: "https://github.com/login/oauth/authorize?state=encrypted-proxy-state",
      }),
      {
        headers: {
          "content-type": "application/json",
          location: "https://github.com/login/oauth/authorize?state=raw-state",
          "set-cookie":
            "__Secure-better-auth.state=raw-state; Path=/; HttpOnly; Secure",
        },
        status: 200,
      }
    )

    const synced = await syncSignInSocialLocationHeader(request, response)

    expect(synced.headers.get("location")).toBe(
      "https://github.com/login/oauth/authorize?state=encrypted-proxy-state"
    )
    expect(await synced.json()).toEqual({
      redirect: true,
      url: "https://github.com/login/oauth/authorize?state=encrypted-proxy-state",
    })
    expect(synced.headers.get("set-cookie")).toContain(
      "__Secure-better-auth.state=raw-state"
    )
  })

  it("leaves non-sign-in responses alone", async () => {
    const request = new Request(
      "https://preview.example.com/api/auth/callback/github"
    )
    const response = new Response("ok", {
      headers: {
        location: "https://example.com/a",
      },
    })

    expect(await syncSignInSocialLocationHeader(request, response)).toBe(
      response
    )
  })
})
