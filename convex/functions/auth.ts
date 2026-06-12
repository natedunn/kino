import { convex } from "kitcn/auth"
import { createAuthMiddleware } from "better-auth/api"
import { admin, oAuthProxy, organization, username } from "better-auth/plugins"
import {
  getBetterAuthAllowedHosts,
  getEnv,
  getGitHubAuthEnv,
  getJwksEnv,
  getOAuthProxyCurrentUrlEnv,
  getOAuthProxyProductionUrlEnv,
  getOAuthProxySecretEnv,
  getTrustedForwardedAuthOrigin,
  getTrustedOrigins,
} from "../lib/get-env"
import authConfig from "./auth.config"
import { defineAuth } from "./generated/auth"
import { ensureUserBootstrap, ensureUniqueUsername } from "../lib/kino"

const DEFAULT_OAUTH_PROXY_PRODUCTION_URL = "https://usekino.com"

function isSuperAdminEmail(email: string) {
  const configured = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.SUPER_ADMIN_EMAIL
  return !!configured && configured.toLowerCase() === email.toLowerCase()
}

function isLoopbackSiteUrl(siteUrl: string) {
  try {
    const hostname = new URL(siteUrl).hostname.toLowerCase()
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    )
  } catch {
    return false
  }
}

export function forwardedAuthRequestUrl(request: Request | undefined) {
  const forwardedOrigin = getTrustedForwardedAuthOrigin(request)
  if (!forwardedOrigin || !request) return null

  try {
    const url = new URL(request.url)
    return `${forwardedOrigin.protocol}://${forwardedOrigin.host}${url.pathname}${url.search}`
  } catch {
    return null
  }
}

export function forwardedAuthRequestContext(request: Request | undefined) {
  const forwardedUrl = forwardedAuthRequestUrl(request)
  if (!forwardedUrl || !request) return null

  return {
    request: new Request(forwardedUrl, {
      headers: request.headers,
      method: request.method,
    }),
  }
}

export function defaultOAuthProxyProductionUrl(env: { SITE_URL: string }) {
  if (isLoopbackSiteUrl(env.SITE_URL)) {
    return DEFAULT_OAUTH_PROXY_PRODUCTION_URL
  }

  return env.SITE_URL.startsWith("http://") ? undefined : env.SITE_URL
}

function forwardedAuthRequestPlugin() {
  return {
    id: "forwarded-auth-request",
    hooks: {
      before: [
        {
          matcher(context: { path?: string }) {
            return !!(
              context.path?.startsWith("/sign-in/social") ||
              context.path?.startsWith("/sign-in/oauth2")
            )
          },
          handler: createAuthMiddleware(async (ctx: any) => {
            const context = forwardedAuthRequestContext(ctx.request)
            if (!context) return

            return { context }
          }),
        },
      ],
    },
  }
}

export default defineAuth(() => {
  const env = getEnv()
  const githubAuth = getGitHubAuthEnv()
  const jwks = getJwksEnv()
  const oauthProxyCurrentUrl = getOAuthProxyCurrentUrlEnv()
  const oauthProxyProductionUrl =
    getOAuthProxyProductionUrlEnv() ?? defaultOAuthProxyProductionUrl(env)
  const oauthProxySecret = getOAuthProxySecretEnv()
  const trustedOrigins = getTrustedOrigins()
  const isLocalHttp = env.SITE_URL.startsWith("http://")
  const baseURLProtocol: "auto" | "https" = env.SITE_URL.startsWith("http://")
    ? "auto"
    : "https"
  const baseOptions = {
    account: {
      accountLinking: {
        enabled: true,
      },
    },
    advanced: {
      trustedProxyHeaders: true,
      useSecureCookies: !isLocalHttp,
    },
    emailAndPassword: {
      enabled: true,
    },
    baseURL: {
      allowedHosts: getBetterAuthAllowedHosts(),
      fallback: env.SITE_URL,
      protocol: baseURLProtocol,
    },
    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 39,
      }),
      admin(),
      organization({
        schema: {
          organization: {
            additionalFields: {
              visibility: {
                required: true,
                type: "string",
              },
            },
          },
        },
      }),
      forwardedAuthRequestPlugin(),
      ...(oauthProxySecret
        ? [
            oAuthProxy({
              ...(oauthProxyCurrentUrl
                ? { currentURL: oauthProxyCurrentUrl }
                : {}),
              productionURL: oauthProxyProductionUrl,
              secret: oauthProxySecret,
            }),
          ]
        : []),
      convex({
        authConfig,
        jwks,
      }),
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24 * 15,
    },
    telemetry: { enabled: false },
    trustedOrigins,
    user: {
      additionalFields: {
        profileId: {
          type: "string" as const,
          required: false,
        },
      },
    },
    triggers: {
      organization: {
        change: async (change: any, ctx: any) => {
          if (change.operation !== "update") return

          const db = (ctx as any).db
          if (change.newDoc.slug !== change.oldDoc.slug) {
            const projects = await db
              .query("project")
              .withIndex("by_orgSlug", (q: any) =>
                q.eq("orgSlug", change.oldDoc.slug)
              )
              .collect()

            await Promise.all(
              projects.map((project: any) =>
                db.patch(project._id, { orgSlug: change.newDoc.slug })
              )
            )
          }
        },
      },
      user: {
        create: {
          before: async (data: any, ctx: any) => {
            const orm = (ctx as any).orm
            const usernameValue =
              data.username ??
              data.email.split("@")[0] ??
              data.name ??
              `user_${crypto.randomUUID().slice(0, 8)}`
            const resolvedUsername = await ensureUniqueUsername(
              { db: (ctx as any).db, orm },
              usernameValue
            )
            return {
              data: {
                ...data,
                role: isSuperAdminEmail(data.email)
                  ? "system:admin"
                  : (data.role ?? "user"),
                username: resolvedUsername,
              },
            }
          },
          after: async (user: any, ctx: any) => {
            await ensureUserBootstrap(ctx as any, user)
          },
        },
        change: async (change: any, ctx: any) => {
          if (change.operation === "delete") {
            const profileId = change.oldDoc.profileId
            if (!profileId) return
            const db = (ctx as any).db
            const profile = await db.get(profileId as any)
            if (!profile) return
            await db.delete(profile._id)
            return
          }

          const profileId = change.newDoc.profileId
          if (!profileId) return

          const role =
            change.newDoc.role === "system:admin" ||
            change.newDoc.role === "system:editor" ||
            change.newDoc.role === "user"
              ? change.newDoc.role
              : "user"

          const db = (ctx as any).db
          const profile = await db.get(profileId as any)
          if (!profile) return
          await db.patch(profile._id, {
            email: change.newDoc.email,
            imageUrl: change.newDoc.image,
            name: change.newDoc.name,
            role,
            username: change.newDoc.username ?? undefined,
          })
        },
      },
      session: {
        create: {
          after: async (session: any, ctx: any) => {
            const user = await (ctx as any).orm.query.user.findFirst({
              where: { id: session.userId },
            })
            if (!user) return

            await ensureUserBootstrap(ctx as any, user)
          },
        },
      },
    },
  }

  if (githubAuth.clientId && githubAuth.clientSecret) {
    return {
      ...baseOptions,
      socialProviders: {
        github: {
          clientId: githubAuth.clientId,
          clientSecret: githubAuth.clientSecret,
        },
      },
    }
  }

  return baseOptions
})
