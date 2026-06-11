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
} from "../lib/github"
import { createGithubCaller } from "./generated/github.runtime"

function projectGitHubSettingsUrl(args: {
  orgSlug: string
  projectSlug: string
  siteUrl?: string
  status: "connected" | "error"
}) {
  const siteUrl = (args.siteUrl ?? getEnv().SITE_URL).replace(/\/$/, "")
  return `${siteUrl}/@${args.orgSlug}/${args.projectSlug}/integrations/github?github=${args.status}`
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

function summarizeWebhookPayload(payload: any) {
  return {
    action: typeof payload.action === "string" ? payload.action : undefined,
    installationId:
      typeof payload.installation?.id === "number"
        ? payload.installation.id
        : undefined,
    repositoryFullName:
      typeof payload.repository?.full_name === "string"
        ? payload.repository.full_name
        : undefined,
    repositoryId:
      typeof payload.repository?.id === "number" ? payload.repository.id : undefined,
    sender:
      typeof payload.sender?.login === "string" ? payload.sender.login : undefined,
  }
}

export const callback = publicRoute
  .get("/api/github/callback")
  .searchParams(
    z.object({
      code: z.string().optional(),
      installation_id: z.coerce.number().int().optional(),
      setup_action: z.string().optional(),
      state: z.string().optional(),
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
        const result = await caller.completeUserInstallationsCallback({
          installations: userInstallations.map(sanitizeGitHubInstallationDetails),
          state: searchParams.state,
        })
        redirect = projectGitHubSettingsUrl({
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
        throw new Error("GitHub installation was not available to the authorizing user")
      }

      const installation = await getAppInstallation(searchParams.installation_id)
      const result = await caller.completeInstallationCallback({
        installation: sanitizeGitHubInstallationDetails(installation),
        setupAction: searchParams.setup_action,
        state: searchParams.state,
      })
      redirect = projectGitHubSettingsUrl({
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

export const oauthCallback = publicRoute
  .get("/api/github/oauth-callback")
  .searchParams(
    z.object({
      code: z.string().optional(),
      error: z.string().optional(),
      error_description: z.string().optional(),
      installation_id: z.coerce.number().int().optional(),
      setup_action: z.string().optional(),
      state: z.string().optional(),
    })
  )
  .query(async ({ c, searchParams }) => {
    try {
      if (!searchParams.state) {
        throw new Error("GitHub callback is missing state")
      }

      const state = await verifyGitHubAppState(searchParams.state)
      const target = new URL(state.targetUrl)
      for (const [key, value] of Object.entries(searchParams)) {
        if (value !== undefined) {
          target.searchParams.set(key, String(value))
        }
      }

      return c.redirect(target.toString())
    } catch {
      const redirect = `${getEnv().SITE_URL.replace(/\/$/, "")}/dashboard?github=error`
      return c.redirect(redirect)
    }
  })

export const webhook = publicRoute
  .post("/api/github/webhook")
  .mutation(async ({ ctx, c }) => {
    const body = await c.req.text()
    const signature = c.req.header("x-hub-signature-256")
    const valid = await verifyGitHubWebhookSignature({ body, signature })
    if (!valid) {
      return c.json({ error: "Invalid signature" }, 401)
    }

    const deliveryId = c.req.header("x-github-delivery")
    const event = c.req.header("x-github-event")
    if (!deliveryId || !event) {
      return c.json({ error: "Missing GitHub webhook headers" }, 400)
    }

    let payload: any
    try {
      payload = JSON.parse(body)
    } catch {
      return c.json({ error: "Invalid JSON payload" }, 400)
    }

    const summary = summarizeWebhookPayload(payload)
    const caller = createGithubCaller(ctx)
    const result = await caller.recordWebhookDelivery({
      action: summary.action,
      deliveryId,
      event,
      installationId: summary.installationId,
      payloadSummary: summary,
      repoId: summary.repositoryId,
    })

    return c.json({ ok: true, ...result })
  })

export const githubRoutes = router({
  callback,
  oauthCallback,
  webhook,
})
