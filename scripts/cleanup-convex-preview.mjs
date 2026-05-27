#!/usr/bin/env node

const previewIdentifier = process.argv[2]
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

if (!previewIdentifier) {
  console.error("Usage: cleanup-convex-preview.mjs <preview-identifier>")
  process.exit(1)
}

if (!token) {
  console.log(
    "Skipping Convex preview cleanup: missing CONVEX_MANAGEMENT_TOKEN."
  )
  process.exit(0)
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

const projectId = await getProjectId()
const deployments = await convexFetch(
  `/projects/${encodeURIComponent(
    projectId
  )}/list_deployments?deploymentType=preview&isDefault=false`
)

const deployment = deployments.find(
  (item) =>
    item?.kind === "cloud" &&
    item?.deploymentType === "preview" &&
    item?.previewIdentifier === previewIdentifier
)

if (!deployment) {
  console.log(
    `No Convex preview deployment found for preview identifier '${previewIdentifier}'.`
  )
  process.exit(0)
}

if (!deployment.name) {
  throw new Error(
    `Convex preview deployment '${previewIdentifier}' is missing a deployment name.`
  )
}

await convexFetch(
  `/deployments/${encodeURIComponent(deployment.name)}/delete`,
  { method: "POST" }
)

console.log(
  `Deleted Convex preview deployment ${deployment.name} for preview identifier '${previewIdentifier}'.`
)
