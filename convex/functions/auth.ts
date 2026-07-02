import { convex } from "kitcn/auth"
import { oAuthProxy, organization, username } from "better-auth/plugins"
import {
  NuntlyProvider,
  ReactEmailRenderer,
  betterEmail,
} from "@nuntly/better-email"
import { render } from "@react-email/render"
import { createElement } from "react"
import { emailSubjects, emailTemplates } from "../emails"
import { resolveSender } from "../lib/email-senders"
import {
  getBetterAuthAllowedHosts,
  getEnv,
  getGitHubAuthEnv,
  getJwksEnv,
  getNuntlyEnv,
  getOAuthProxyProductionUrlEnv,
  getOAuthProxySecretEnv,
  getTrustedOrigins,
} from "../lib/get-env"
import { ac, roles } from "../shared/auth-roles"
import {
  ensureUniqueUsername,
  ensureUserBootstrap,
  sanitizeSystemRole,
} from "../lib/kino"
import authConfig from "./auth.config"
import { defineAuth } from "./generated/auth"

function isSuperAdminEmail(email: string) {
  const configured = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.SUPER_ADMIN_EMAIL
  return !!configured && configured.toLowerCase() === email.toLowerCase()
}

export default defineAuth(() => {
  const env = getEnv()
  const githubAuth = getGitHubAuthEnv()
  const jwks = getJwksEnv()
  // Every environment must point this at its tier gateway
  // (https://gateway-dev.usekino.com or https://gateway.usekino.com).
  // No default: a wrong fallback would send GitHub a redirect_uri it rejects.
  const oauthProxyProductionUrl = getOAuthProxyProductionUrlEnv()
  const oauthProxySecret = getOAuthProxySecretEnv()

  if (oauthProxySecret && !oauthProxyProductionUrl) {
    console.warn(
      "OAUTH_PROXY_SECRET is set but OAUTH_PROXY_PRODUCTION_URL is not — " +
        "the OAuth proxy is disabled and GitHub login will fail. Set " +
        "OAUTH_PROXY_PRODUCTION_URL to this tier's gateway origin " +
        "(see docs/github-environments.md)."
    )
  }
  const trustedOrigins = getTrustedOrigins()

  // Nuntly email is wired only when an API key is configured. Without it we keep
  // the GitHub-only behavior rather than breaking sign-up (sendOnSignUp would
  // throw with no provider). `betterEmail`'s init() auto-supplies
  // emailVerification.sendVerificationEmail + emailAndPassword.sendResetPassword;
  // its helpers wire magic-link / OTP / org-invitation.
  const nuntly = getNuntlyEnv()
  // Email needs both a key and a resolvable sending domain (explicit
  // NUNTLY_EMAIL_DOMAIN, or derived from NUNTLY_FROM). Missing either keeps the
  // app GitHub-only rather than throwing at auth init.
  const emailConfigured =
    Boolean(nuntly.apiKey) && Boolean(nuntly.emailDomain || nuntly.fromAddress)
  if (!emailConfigured) {
    console.warn(
      "[nuntly] Email is DISABLED (auth verification, reset, magic link, OTP, " +
        "invitations). Set NUNTLY_API_KEY and NUNTLY_EMAIL_DOMAIN (or " +
        "NUNTLY_FROM) in the Convex deployment env (`npx convex env set …`, " +
        "not just .env.local) and restart."
    )
  }
  const authSender = emailConfigured ? resolveSender("auth") : null
  const emailPlugin = authSender
    ? betterEmail({
        provider: new NuntlyProvider({
          apiKey: nuntly.apiKey!,
          from: authSender.from,
        }),
        templateRenderer: new ReactEmailRenderer({
          render,
          createElement,
          templates: emailTemplates,
          subjects: emailSubjects,
        }),
        // Surface delivery outcomes in the Convex logs so a bad key / unverified
        // domain is visible instead of silently swallowed.
        onAfterSend: (context, message) => {
          console.log(
            `[nuntly] sent ${context.type} to ${message.to} from ${authSender.from}`
          )
          return Promise.resolve()
        },
        onSendError: (context, message, error) => {
          console.error(
            `[nuntly] FAILED to send ${context.type} to ${message.to}: ` +
              (error instanceof Error ? error.message : String(error))
          )
          return Promise.resolve()
        },
      })
    : null

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
      // sendResetPassword is injected by the betterEmail plugin's init().
      enabled: true,
      // Require a verified email before a password account can sign in. This
      // means sign-up does NOT create a session — the user must click the
      // verification link first. Only enforced when email is actually
      // configured; otherwise there'd be no way to verify and password users
      // would be permanently locked out. GitHub OAuth supplies an already-
      // verified email, so it is unaffected.
      ...(emailPlugin ? { requireEmailVerification: true } : {}),
    },
    // When email is configured, send a verification email on sign-up. Combined
    // with requireEmailVerification above, the link is what unlocks sign-in.
    ...(emailPlugin ? { emailVerification: { sendOnSignUp: true } } : {}),
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
      organization({
        ac,
        roles,
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
        ...(emailPlugin
          ? { sendInvitationEmail: emailPlugin.helpers.invitation }
          : {}),
      }),
      ...(emailPlugin ? [emailPlugin] : []),
      ...(oauthProxySecret && oauthProxyProductionUrl
        ? [
            oAuthProxy({
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
        // `input: false` is a SECURITY REQUIREMENT, not a nicety. Better-auth
        // additional fields default to client-writable: without this, the
        // public `/api/auth/sign-up/email` and `/api/auth/update-user` routes
        // would accept these fields straight from the request body
        // (`parseInputData` in better-auth only rejects a field when
        // `input === false`). `profileId` and `role` are set exclusively
        // server-side (the `user.create.before` / `user.change` triggers and
        // `ensureUserBootstrap`), so the client must never be able to supply
        // them — a self-assigned `role: "system:admin"` would grant full
        // access via verifyOrgAccess/verifyProjectAccess.
        profileId: {
          type: "string" as const,
          required: false,
          input: false,
        },
        // `role` previously came from the better-auth admin plugin. With that
        // plugin removed we declare it here so better-auth keeps persisting it
        // on create/update and returning it on the session. `user.role` remains
        // the source of truth; `profile.role` is the derived copy. Writes only
        // ever happen server-side (super-admin bootstrap), never from client
        // input — hence `input: false`.
        role: {
          type: "string" as const,
          required: false,
          input: false,
        },
      },
    },
    triggers: {
      organization: {
        change: async (change: any, ctx: any) => {
          if (change.operation !== "update") return

          if (change.newDoc.slug !== change.oldDoc.slug) {
            const db = (ctx).db
            const now = Date.now()
            // These `.collect()`s are intentionally unbounded: every row is
            // scoped to this single organization (its projects, storage row,
            // GitHub connections/installations), so the set is bounded by one
            // org's resources and we must rewrite all of them to keep the
            // denormalized `orgSlug` consistent. A `.take()` here would silently
            // leave rows pointing at the old slug. Org slug renames are rare.
            const [
              projects,
              storageRows,
              connectionStates,
              installations,
              repoConnections,
            ] = await Promise.all([
              db
                .query("project")
                .withIndex("by_orgSlug", (q: any) =>
                  q.eq("orgSlug", change.oldDoc.slug)
                )
                .collect(),
              db
                .query("orgStorageUsage")
                .withIndex("by_orgSlug", (q: any) =>
                  q.eq("orgSlug", change.oldDoc.slug)
                )
                .collect(),
              db
                .query("githubConnectionState")
                .withIndex("by_orgId", (q: any) =>
                  q.eq("orgId", change.newDoc.id)
                )
                .collect(),
              db
                .query("githubInstallation")
                .withIndex("by_orgId", (q: any) =>
                  q.eq("orgId", change.newDoc.id)
                )
                .collect(),
              db
                .query("githubRepositoryConnection")
                .withIndex("by_orgId_repoId", (q: any) =>
                  q.eq("orgId", change.newDoc.id)
                )
                .collect(),
            ])

            await Promise.all([
              ...projects.map((project: any) =>
                db.patch(project._id, { orgSlug: change.newDoc.slug })
              ),
              ...storageRows.map((row: any) =>
                db.patch(row._id, {
                  orgSlug: change.newDoc.slug,
                  updatedTime: now,
                })
              ),
              ...connectionStates.map((state: any) =>
                db.patch(state._id, {
                  orgSlug: change.newDoc.slug,
                  updatedTime: now,
                })
              ),
              ...installations.map((installation: any) =>
                db.patch(installation._id, {
                  orgSlug: change.newDoc.slug,
                  updatedTime: now,
                })
              ),
              ...repoConnections.map((connection: any) =>
                db.patch(connection._id, {
                  orgSlug: change.newDoc.slug,
                  updatedTime: now,
                })
              ),
            ])
          }
        },
      },
      user: {
        create: {
          before: async (data: any, ctx: any) => {
            const orm = (ctx).orm
            const usernameValue =
              data.username ??
              data.email.split("@")[0] ??
              data.name ??
              `user_${crypto.randomUUID().slice(0, 8)}`
            const resolvedUsername = await ensureUniqueUsername(
              { db: (ctx).db, orm },
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
            await ensureUserBootstrap(ctx, user)
          },
        },
        change: async (change: any, ctx: any) => {
          if (change.operation === "delete") {
            const profileId = change.oldDoc.profileId
            if (!profileId) return
            const db = (ctx).db
            const profile = await db.get(profileId)
            if (!profile) return
            await db.delete(profile._id)
            return
          }

          const profileId = change.newDoc.profileId
          if (!profileId) return

          const role = sanitizeSystemRole(change.newDoc.role)

          const db = (ctx).db
          const profile = await db.get(profileId)
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
            const user = await (ctx).orm.query.user.findFirst({
              where: { id: session.userId },
            })
            if (!user) return

            await ensureUserBootstrap(ctx, user)
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
