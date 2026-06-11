function convexGithubRequestUrl(requestUrl: string) {
  const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL
  if (!convexSiteUrl) {
    throw new Error("VITE_CONVEX_SITE_URL is required for GitHub callbacks.")
  }

  const request = new URL(requestUrl)
  const target = new URL(convexSiteUrl)
  target.pathname = request.pathname
  target.search = request.search
  target.hash = request.hash
  return target.toString()
}

const STRIPPED_PROXY_REQUEST_HEADERS = new Set([
  "accept-encoding",
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "connection",
  "content-length",
  "host",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
])

export function cloneGitHubProxyRequestHeaders(source: Headers) {
  const headers = new Headers()
  for (const [key, value] of source.entries()) {
    const normalized = key.toLowerCase()
    if (
      STRIPPED_PROXY_REQUEST_HEADERS.has(normalized) ||
      normalized.startsWith("cf-")
    ) {
      continue
    }
    headers.append(key, value)
  }
  return headers
}

function cloneResponseHeaders(source: Headers) {
  const headers = new Headers()
  for (const [key, value] of source.entries()) {
    headers.append(key, value)
  }
  return headers
}

export async function handler(request: Request) {
  const targetUrl = convexGithubRequestUrl(request.url)
  const init: RequestInit & { duplex?: "half" } = {
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : request.body,
    duplex: "half",
    headers: cloneGitHubProxyRequestHeaders(request.headers),
    method: request.method,
    redirect: "manual",
  }

  const response = await fetch(targetUrl, init)

  return new Response(response.body, {
    headers: cloneResponseHeaders(response.headers),
    status: response.status,
    statusText: response.statusText,
  })
}
