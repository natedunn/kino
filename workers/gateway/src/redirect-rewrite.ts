import { isTrustedTargetOrigin, type GatewayEnv } from "./env"

/**
 * Rewrites the oAuthProxy callback redirect to the originating app origin.
 *
 * Why: when an app env starts a GitHub sign-in, better-auth's oAuthProxy
 * embeds a "return to" URL in the encrypted state. Because the app's auth
 * handler runs on Convex, that URL is built from the Convex site URL
 * (`https://<deployment>.convex.site/api/auth/oauth-proxy-callback?...`)
 * instead of the app's own origin — the forwarded-host plugin does not reach
 * the oAuthProxy hook's request URL. If the browser followed that redirect
 * directly, the session cookies would be set for `*.convex.site` and the app
 * origin would stay logged out.
 *
 * The previous prod-anchored architecture had this exact rewrite in the app
 * worker (`rewriteAuthRedirectLocation` in src/lib/convex/auth-server.ts).
 * The gateway now plays that role: when the auth handler responds with a
 * redirect to `*.convex.site/api/auth/oauth-proxy-callback`, swap the
 * protocol/host to the inner `callbackURL`'s origin — the actual app origin,
 * validated against the tier's trusted target patterns. The app worker then
 * proxies the request to its Convex deployment itself, and the cookies land
 * on the app origin.
 */
export function rewriteProxyCallbackRedirect(
  env: GatewayEnv,
  response: Response
) {
  if (response.status < 300 || response.status >= 400) return response

  const location = response.headers.get("location")
  if (!location) return response

  let target: URL
  try {
    target = new URL(location)
  } catch {
    return response
  }

  if (
    !target.hostname.endsWith(".convex.site") ||
    !target.pathname.startsWith("/api/auth/oauth-proxy-callback")
  ) {
    return response
  }

  const callbackURL = target.searchParams.get("callbackURL")
  if (!callbackURL) return response

  let appOrigin: URL
  try {
    appOrigin = new URL(callbackURL)
  } catch {
    return response
  }

  const origin = `${appOrigin.protocol}//${appOrigin.host}`
  if (!isTrustedTargetOrigin(env, origin)) {
    console.warn(`proxy callback rewrite refused for untrusted origin ${origin}`)
    return response
  }

  target.protocol = appOrigin.protocol
  target.host = appOrigin.host

  const headers = new Headers(response.headers)
  headers.set("location", target.toString())

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}
