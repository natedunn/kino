import { convexBetterAuthReactStart } from "kitcn/auth/start"
import { splitSetCookieHeader } from "better-auth/cookies"

function createAuth() {
  return convexBetterAuthReactStart({
    convexUrl: import.meta.env.VITE_CONVEX_URL!,
    convexSiteUrl: import.meta.env.VITE_CONVEX_SITE_URL!,
  })
}

type AuthHelpers = ReturnType<typeof createAuth>

let authSingleton: AuthHelpers | undefined

function getAuth() {
  authSingleton ??= createAuth()
  return authSingleton
}

type HeadersWithSetCookieList = Headers & {
  getSetCookie?: () => string[]
}

export function getSetCookieValues(source: Headers) {
  const getSetCookie = (source as HeadersWithSetCookieList).getSetCookie
  if (typeof getSetCookie === "function") {
    return getSetCookie.call(source).flatMap((value) => splitSetCookieHeader(value))
  }

  const setCookie = source.get("set-cookie")
  return setCookie ? splitSetCookieHeader(setCookie) : []
}

function getSetCookieNames(source: Headers) {
  return getSetCookieValues(source)
    .map((value) => value.split("=", 1)[0]?.trim())
    .filter((value): value is string => !!value)
}

function shouldLogAuthDebug() {
  return true
}

function sanitizeAuthUrl(url: string) {
  try {
    const parsed = new URL(url)
    const safe = new URL(`${parsed.origin}${parsed.pathname}`)

    const callbackURL = parsed.searchParams.get("callbackURL")
    if (callbackURL) {
      safe.searchParams.set("callbackURL", callbackURL)
    }

    const error = parsed.searchParams.get("error")
    if (error) {
      safe.searchParams.set("error", error)
    }

    return safe.toString()
  } catch {
    return url
  }
}

function isAuthDebugRequest(request: Request) {
  try {
    const { pathname } = new URL(request.url)
    return (
      pathname.startsWith("/api/auth/sign-in/social") ||
      pathname.startsWith("/api/auth/callback/") ||
      pathname.startsWith("/api/auth/oauth-proxy-callback") ||
      pathname.startsWith("/api/auth/get-session")
    )
  } catch {
    return false
  }
}

function isSignInSocialRequest(request: Request) {
  try {
    const { pathname } = new URL(request.url)
    return pathname.startsWith("/api/auth/sign-in/social")
  } catch {
    return false
  }
}

function getJsonRedirectUrl(body: string) {
  try {
    const parsed = JSON.parse(body) as { url?: unknown }
    return typeof parsed.url === "string" ? parsed.url : null
  } catch {
    return null
  }
}

export async function syncSignInSocialLocationHeader(
  request: Request,
  response: Response
) {
  const location = response.headers.get("location")
  if (!location || !isSignInSocialRequest(request)) return response

  const body = await response
    .clone()
    .text()
    .catch(() => null)
  if (!body) return response

  const redirectUrl = getJsonRedirectUrl(body)
  if (!redirectUrl || redirectUrl === location) return response

  const headers = cloneHeadersPreservingSetCookie(response.headers)
  headers.set("location", redirectUrl)

  return new Response(body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}

function logAuthDebug(
  request: Request,
  response: Response,
  rewrittenLocation?: string
) {
  if (!shouldLogAuthDebug() || !isAuthDebugRequest(request)) return

  const location = rewrittenLocation ?? response.headers.get("location")
  const cookieNames = getSetCookieNames(response.headers)

  console.log(
    "[auth-debug]",
    JSON.stringify({
      cookieNames,
      location: location ? sanitizeAuthUrl(location) : null,
      method: request.method,
      requestUrl: sanitizeAuthUrl(request.url),
      status: response.status,
    })
  )
}

function isTrustedAuthRedirectOrigin(origin: URL) {
  const hostname = origin.hostname.toLowerCase()

  return (
    hostname === "usekino.com" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith("-kino.hello-fc8.workers.dev") ||
    hostname === "kino.hello-fc8.workers.dev"
  )
}

function isConvexSiteAuthCallback(url: URL) {
  return (
    url.hostname.endsWith(".convex.site") &&
    url.pathname.startsWith("/api/auth/oauth-proxy-callback")
  )
}

export function rewriteAuthRedirectLocation({
  convexSiteUrl,
  location,
  requestUrl,
}: {
  convexSiteUrl: string
  location: string
  requestUrl: string
}) {
  try {
    const request = new URL(requestUrl)
    const target = new URL(location, request)
    const convexSite = new URL(convexSiteUrl)

    if (isConvexSiteAuthCallback(target)) {
      const callbackURL = target.searchParams.get("callbackURL")
      if (!callbackURL) return location

      const callbackTarget = new URL(callbackURL)
      if (!isTrustedAuthRedirectOrigin(callbackTarget)) return location

      target.protocol = callbackTarget.protocol
      target.host = callbackTarget.host

      return target.toString()
    }

    if (target.origin !== convexSite.origin) {
      return location
    }

    if (!target.pathname.startsWith("/api/auth/")) {
      return location
    }

    target.protocol = request.protocol
    target.host = request.host

    return target.toString()
  } catch {
    return location
  }
}

export function cloneHeadersPreservingSetCookie(source: Headers) {
  const headers = new Headers()

  for (const [key, value] of source.entries()) {
    if (key.toLowerCase() === "set-cookie") continue
    headers.append(key, value)
  }

  const getSetCookie = (source as HeadersWithSetCookieList).getSetCookie
  if (typeof getSetCookie === "function") {
    for (const value of getSetCookieValues(source)) {
      headers.append("set-cookie", value)
    }
    return headers
  }

  for (const value of getSetCookieValues(source)) {
    headers.append("set-cookie", value)
  }

  return headers
}

function cloneAuthResponse(response: Response) {
  return new Response(response.body, {
    headers: cloneHeadersPreservingSetCookie(response.headers),
    status: response.status,
    statusText: response.statusText,
  })
}

export async function handler(request: Request) {
  const response = await syncSignInSocialLocationHeader(
    request,
    await getAuth().handler(request)
  )
  const location = response.headers.get("location")

  if (!location) {
    const clonedResponse = cloneAuthResponse(response)
    logAuthDebug(request, clonedResponse)
    return clonedResponse
  }

  const rewrittenLocation = rewriteAuthRedirectLocation({
    convexSiteUrl: import.meta.env.VITE_CONVEX_SITE_URL!,
    location,
    requestUrl: request.url,
  })

  if (rewrittenLocation === location) {
    const clonedResponse = cloneAuthResponse(response)
    logAuthDebug(request, clonedResponse)
    return clonedResponse
  }

  const headers = cloneHeadersPreservingSetCookie(response.headers)
  headers.set("location", rewrittenLocation)

  const rewrittenResponse = new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })

  logAuthDebug(request, rewrittenResponse, rewrittenLocation)

  return rewrittenResponse
}

export const getToken: AuthHelpers["getToken"] = () => getAuth().getToken()

export const fetchAuthQuery: AuthHelpers["fetchAuthQuery"] = (...args) => {
  return getAuth().fetchAuthQuery(...args)
}

export const fetchAuthMutation: AuthHelpers["fetchAuthMutation"] = (
  ...args
) => {
  return getAuth().fetchAuthMutation(...args)
}

export const fetchAuthAction: AuthHelpers["fetchAuthAction"] = (...args) => {
  return getAuth().fetchAuthAction(...args)
}
