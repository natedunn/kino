import {
  getEnv,
  getTrustedForwardedAuthOrigin,
  isTrustedOrigin,
} from "../lib/get-env"
import { getAuth } from "./generated/auth"
import { cors } from "hono/cors"
import { createHttpRouter } from "kitcn/server"
import { Hono } from "hono"
import { router } from "../lib/crpc"
// __KITCN_HTTP_IMPORTS__

const app = new Hono()

function restoreTrustedForwardedAuthHeaders(request: Request) {
  const forwardedOrigin = getTrustedForwardedAuthOrigin(request)
  if (!forwardedOrigin) return request

  const headers = new Headers(request.headers)
  headers.set("x-forwarded-host", forwardedOrigin.host)
  headers.set("x-forwarded-proto", forwardedOrigin.protocol)

  const init: RequestInit & { duplex?: "half" } = {
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : request.body,
    duplex: "half",
    headers,
    method: request.method,
  }

  return new Request(request.url, init)
}

app.use(
  "/api/*",
  cors({
    origin: (origin) => (isTrustedOrigin(origin) ? origin : getEnv().SITE_URL),
    allowHeaders: ["Content-Type", "Authorization", "Better-Auth-Cookie"],
    exposeHeaders: ["Set-Better-Auth-Cookie"],
    credentials: true,
  })
)

app.use(async (c, next) => {
  if (c.req.path === "/.well-known/openid-configuration") {
    return c.redirect(
      `${process.env.CONVEX_SITE_URL}/api/auth/convex/.well-known/openid-configuration`
    )
  }

  if (c.req.path.startsWith("/api/auth")) {
    return getAuth(c.env as any).handler(
      restoreTrustedForwardedAuthHeaders(c.req.raw)
    )
  }

  return next()
})

export const httpRouter = router({
  // __KITCN_HTTP_ROUTES__
})

export default createHttpRouter(app, httpRouter)
