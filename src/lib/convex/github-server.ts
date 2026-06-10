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

function cloneHeaders(source: Headers) {
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
    headers: request.headers,
    method: request.method,
  }

  const response = await fetch(targetUrl, init)

  return new Response(response.body, {
    headers: cloneHeaders(response.headers),
    status: response.status,
    statusText: response.statusText,
  })
}
