import { getEnv } from "../lib/get-env"
import {
  getAppInstallation,
  verifyGitHubAppState,
} from "../lib/github-client"

export function projectGitHubSettingsUrl(args: {
  orgSlug: string
  projectSlug: string
  siteUrl?: string
  status: "connected" | "error"
}) {
  const siteUrl = (args.siteUrl ?? getEnv().SITE_URL).replace(/\/$/, "")
  return `${siteUrl}/@${args.orgSlug}/${args.projectSlug}/settings/integrations?github=${args.status}`
}

export function orgGitHubSettingsUrl(args: {
  orgSlug: string
  siteUrl?: string
  status: "connected" | "error"
}) {
  const siteUrl = (args.siteUrl ?? getEnv().SITE_URL).replace(/\/$/, "")
  return `${siteUrl}/org/settings/integrations?org=${encodeURIComponent(
    args.orgSlug
  )}&github=${args.status}`
}

export function githubSettingsUrl(args: {
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

export async function siteUrlFromState(state: string | undefined) {
  if (!state) return getEnv().SITE_URL

  try {
    const payload = await verifyGitHubAppState(state)
    return new URL(payload.targetUrl).origin
  } catch {
    return getEnv().SITE_URL
  }
}

export function isGitHubNotFoundError(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  return (
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "NOT_FOUND") ||
    message.includes("GitHub request failed (404)")
  )
}

export async function findDeletedInstallationIds(args: {
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
