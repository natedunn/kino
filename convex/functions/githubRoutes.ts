import { z } from "zod"
import { router, publicRoute } from "../lib/crpc"
import {
  exchangeGitHubSetupCode,
  getAppInstallation,
  listUserInstallations,
  sanitizeGitHubInstallationDetails,
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
import {
  findDeletedInstallationIds,
  githubSettingsUrl,
  siteUrlFromState,
} from "./githubRoutes.lib"

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
