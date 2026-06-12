#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

loadEnvFiles()

const args = process.argv.slice(2)
const shouldDelete = args.includes("--delete")
const remote =
  getArgValue("--remote") ?? process.env.PREVIEW_CLEANUP_REMOTE ?? "origin"
const token =
  process.env.CONVEX_MANAGEMENT_TOKEN ??
  process.env.CONVEX_API_TOKEN ??
  process.env.CONVEX_AUTH_TOKEN
const teamSlug =
  process.env.CONVEX_TEAM_SLUG ??
  process.env.CONVEX_TEAM_ID_OR_SLUG ??
  "nate-dunn"
const projectSlug = process.env.CONVEX_PROJECT_SLUG ?? "kino"
const projectIdFromEnv = process.env.CONVEX_PROJECT_ID

if (!token) {
  console.log(
    "Skipping stale Convex preview cleanup: missing CONVEX_MANAGEMENT_TOKEN."
  )
  process.exit(0)
}

function loadEnvFiles() {
  for (const path of [".env.local", ".env"]) {
    if (!existsSync(path)) continue

    const lines = readFileSync(path, "utf8").split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue

      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (!match || process.env[match[1]] !== undefined) continue

      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "")
    }
  }
}

function getArgValue(name) {
  const index = args.indexOf(name)
  if (index === -1) return null
  return args[index + 1] ?? null
}

function previewName(branch, maxLength) {
  const normalized = branch
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength)

  return normalized || "preview"
}

function listRemoteBranches() {
  const output = execFileSync("git", ["ls-remote", "--heads", remote], {
    encoding: "utf8",
  })

  return output
    .split("\n")
    .map((line) => line.trim().match(/refs\/heads\/(.+)$/)?.[1])
    .filter(Boolean)
}

const baseUrl = "https://api.convex.dev/v1"

async function convexFetch(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  })
  const text = await response.text()
  const body = text ? safeJson(text) : null

  if (!response.ok) {
    const message =
      body?.message ??
      body?.error ??
      body?.errors?.map((error) => error.message).join("; ") ??
      `${response.status} ${response.statusText}`
    throw new Error(message)
  }

  return body
}

function safeJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

function formatConvexAuthError(message) {
  if (
    !message.toLowerCase().includes("unauthorized") &&
    !message.toLowerCase().includes("forbidden") &&
    !message.toLowerCase().includes("authentication")
  ) {
    return message
  }

  return [
    `Convex management API auth failed for project '${teamSlug}/${projectSlug}'.`,
    "Use a valid CONVEX_MANAGEMENT_TOKEN with access to this team/project.",
    `Original error: ${message}`,
  ].join(" ")
}

async function getProjectId() {
  if (projectIdFromEnv) return projectIdFromEnv

  const project = await convexFetch(
    `/teams/${encodeURIComponent(teamSlug)}/projects/${encodeURIComponent(
      projectSlug
    )}`
  )

  if (!project?.id) {
    throw new Error(
      `Could not resolve Convex project '${teamSlug}/${projectSlug}'.`
    )
  }

  return project.id
}

async function main() {
  const activePreviewIdentifiers = new Set(
    listRemoteBranches().map((branch) => previewName(branch, 48))
  )
  const projectId = await getProjectId()
  const deployments = await convexFetch(
    `/projects/${encodeURIComponent(
      projectId
    )}/list_deployments?deploymentType=preview&isDefault=false`
  )

  const staleDeployments = deployments.filter(
    (deployment) =>
      deployment?.kind === "cloud" &&
      deployment?.deploymentType === "preview" &&
      deployment?.previewIdentifier &&
      !activePreviewIdentifiers.has(deployment.previewIdentifier)
  )

  if (staleDeployments.length === 0) {
    console.log(
      `No stale Convex preview deployments found for project '${teamSlug}/${projectSlug}'.`
    )
    return
  }

  const mode = shouldDelete ? "Deleting" : "Dry run: would delete"
  console.log(
    `${mode} ${staleDeployments.length} stale Convex preview deployment(s) for project '${teamSlug}/${projectSlug}'.`
  )

  for (const deployment of staleDeployments) {
    const label = `${deployment.name} preview='${deployment.previewIdentifier}'`

    if (!shouldDelete) {
      console.log(`- ${label}`)
      continue
    }

    // Best-effort: drop the deployment's webhook target from the gateway registry.
    execFileSync(
      "node",
      [
        "scripts/gateway-webhook-target.mjs",
        "unregister",
        `https://${deployment.name}.convex.site/api/github/webhook`,
      ],
      { stdio: "inherit" }
    )

    await convexFetch(
      `/deployments/${encodeURIComponent(deployment.name)}/delete`,
      { method: "POST" }
    )
    console.log(`Deleted ${label}.`)
  }

  if (!shouldDelete) {
    console.log("Run again with --delete to delete these deployments.")
  }
}

try {
  await main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(formatConvexAuthError(message))
  process.exit(1)
}
