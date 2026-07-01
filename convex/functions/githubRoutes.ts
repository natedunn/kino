import { z } from "zod"
import { router, publicRoute } from "../lib/crpc"
import { getEnv } from "../lib/get-env"
import {
  exchangeGitHubSetupCode,
  getAppInstallation,
  listUserInstallations,
  sanitizeGitHubInstallationDetails,
  verifyGitHubAppState,
  verifyGitHubWebhookSignature,
} from "../lib/github-client"
import { CRPCError } from "kitcn/server"
import { createGithubCaller } from "./generated/github.runtime"
import {
  githubCodeSchema,
  githubStateSchema,
  webhookActionSchema,
  webhookDeliveryIdSchema,
  webhookEventSchema,
} from "../lib/validation"

function projectGitHubSettingsUrl(args: {
  orgSlug: string
  projectSlug: string
  siteUrl?: string
  status: "connected" | "error"
}) {
  const siteUrl = (args.siteUrl ?? getEnv().SITE_URL).replace(/\/$/, "")
  return `${siteUrl}/@${args.orgSlug}/${args.projectSlug}/settings/integrations?github=${args.status}`
}

function orgGitHubSettingsUrl(args: {
  orgSlug: string
  siteUrl?: string
  status: "connected" | "error"
}) {
  const siteUrl = (args.siteUrl ?? getEnv().SITE_URL).replace(/\/$/, "")
  return `${siteUrl}/org/settings/integrations?org=${encodeURIComponent(
    args.orgSlug
  )}&github=${args.status}`
}

function githubSettingsUrl(args: {
  orgSlug: string
  projectSlug?: string | null
  siteUrl?: string
  status: "connected" | "error"
}) {
  if (args.projectSlug) {
    return projectGitHubSettingsUrl({
      orgSlug: args.orgSlug,
      projectSlug: args.projectSlug,
      siteUrl: args.siteUrl,
      status: args.status,
    })
  }

  return orgGitHubSettingsUrl({
    orgSlug: args.orgSlug,
    siteUrl: args.siteUrl,
    status: args.status,
  })
}

async function siteUrlFromState(state: string | undefined) {
  if (!state) return getEnv().SITE_URL

  try {
    const payload = await verifyGitHubAppState(state)
    return new URL(payload.targetUrl).origin
  } catch {
    return getEnv().SITE_URL
  }
}

function isGitHubNotFoundError(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  return (
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "NOT_FOUND") ||
    message.includes("GitHub request failed (404)")
  )
}

async function findDeletedInstallationIds(args: {
  knownInstallationIds: number[]
  userInstallationIds: Set<number>
}) {
  const deletedInstallationIds: number[] = []
  await Promise.all(
    args.knownInstallationIds.map(async (installationId) => {
      if (args.userInstallationIds.has(installationId)) return

      try {
        await getAppInstallation(installationId)
      } catch (error) {
        if (isGitHubNotFoundError(error)) {
          deletedInstallationIds.push(installationId)
        }
      }
    })
  )
  return deletedInstallationIds
}

export const callback = publicRoute
  .get("/api/github/callback")
  .searchParams(
    z.object({
      code: githubCodeSchema.optional(),
      installation_id: z.coerce.number().int().optional(),
      setup_action: z.string().trim().max(40).optional(),
      state: githubStateSchema.optional(),
    })
  )
  .query(async ({ ctx, c, searchParams }) => {
    const caller = createGithubCaller(ctx)
    const redirectSiteUrl = await siteUrlFromState(searchParams.state)
    let redirect = `${redirectSiteUrl.replace(/\/$/, "")}/dashboard?github=error`

    try {
      if (!searchParams.code || !searchParams.state) {
        throw new Error("GitHub callback is missing required parameters")
      }

      const userToken = await exchangeGitHubSetupCode(searchParams.code)
      const userInstallations = await listUserInstallations(userToken)
      if (!searchParams.installation_id) {
        const refreshState = await caller.getRefreshInstallationsForCallback({
          state: searchParams.state,
        })
        const userInstallationIds = new Set(
          userInstallations.map((installation) => installation.id)
        )
        const deletedInstallationIds = await findDeletedInstallationIds({
          knownInstallationIds: refreshState.installations.map(
            (installation) => installation.installationId
          ),
          userInstallationIds,
        })
        const result = await caller.completeUserInstallationsCallback({
          deletedInstallationIds,
          installations: userInstallations.map(
            sanitizeGitHubInstallationDetails
          ),
          state: searchParams.state,
        })
        redirect = githubSettingsUrl({
          orgSlug: result.orgSlug,
          projectSlug: result.projectSlug,
          siteUrl: redirectSiteUrl,
          status: "connected",
        })
        return c.redirect(redirect)
      }

      const userCanAccessInstallation = userInstallations.some(
        (installation) => installation.id === searchParams.installation_id
      )
      if (!userCanAccessInstallation) {
        throw new Error(
          "GitHub installation was not available to the authorizing user"
        )
      }

      const installation = await getAppInstallation(
        searchParams.installation_id
      )
      const result = await caller.completeInstallationCallback({
        installation: sanitizeGitHubInstallationDetails(installation),
        setupAction: searchParams.setup_action,
        state: searchParams.state,
      })
      redirect = githubSettingsUrl({
        orgSlug: result.orgSlug,
        projectSlug: result.projectSlug,
        siteUrl: redirectSiteUrl,
        status: "connected",
      })
    } catch {
      redirect = `${redirectSiteUrl.replace(/\/$/, "")}/dashboard?github=error`
    }

    return c.redirect(redirect)
  })

// The install/authorize trampoline (GET /api/github/oauth-callback) lives on
// the gateway Worker now (workers/gateway/src/github-relay.ts); the tier
// GitHub App's callback URL points there, never at the app.

export const webhook = publicRoute
  .post("/api/github/webhook")
  .mutation(async ({ ctx, c }) => {
    const body = await c.req.text()
    const verified = await verifyGitHubWebhookSignature(
      body,
      c.req.header("x-hub-signature-256")
    )
    if (!verified) {
      throw new CRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid webhook signature",
      })
    }

    const deliveryId = webhookDeliveryIdSchema.safeParse(
      c.req.header("x-github-delivery")
    )
    const event = webhookEventSchema.safeParse(c.req.header("x-github-event"))
    if (!deliveryId.success || !event.success) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Missing webhook delivery headers",
      })
    }

    let payload: {
      action?: string
      installation?: {
        events?: string[]
        id?: number
        permissions?: Record<string, string>
        repository_selection?: string
      }
      issue?: {
        html_url?: string
        node_id?: string
        number?: number
        state?: string
        title?: string
      }
      repository?: {
        id?: number
      }
    }
    try {
      payload = JSON.parse(body)
    } catch {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Webhook payload is not valid JSON",
      })
    }

    const caller = createGithubCaller(ctx)
    const result = await caller.processWebhookEvent({
      action:
        typeof payload.action === "string"
          ? webhookActionSchema.parse(payload.action)
          : undefined,
      deliveryId: deliveryId.data,
      event: event.data,
      ...(typeof payload.installation?.id === "number"
        ? {
            installation: {
              events: payload.installation.events,
              id: payload.installation.id,
              permissions: payload.installation.permissions,
              repository_selection: payload.installation.repository_selection,
            },
          }
        : {}),
      ...(typeof payload.repository?.id === "number" &&
      typeof payload.issue?.node_id === "string" &&
      typeof payload.issue.number === "number" &&
      typeof payload.issue.title === "string" &&
      typeof payload.issue.html_url === "string" &&
      typeof payload.issue.state === "string"
        ? {
            issue: {
              nodeId: payload.issue.node_id,
              number: payload.issue.number,
              repositoryId: payload.repository.id,
              state: payload.issue.state,
              title: payload.issue.title,
              url: payload.issue.html_url,
            },
          }
        : {}),
    })

    return c.json({ ok: true, ...result }, 200)
  })

export const githubRoutes = router({
  callback,
  webhook,
})
