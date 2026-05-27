#!/usr/bin/env node

import { execFileSync } from "node:child_process"

const args = process.argv.slice(2)
const shouldDelete = args.includes("--delete")
const remote =
  getArgValue("--remote") ?? process.env.PREVIEW_CLEANUP_REMOTE ?? "origin"
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? process.env.CF_ACCOUNT_ID
const apiToken = process.env.CLOUDFLARE_API_TOKEN ?? process.env.CF_API_TOKEN
const workerName =
  process.env.CLOUDFLARE_WORKER_NAME ?? process.env.CF_WORKER_NAME ?? "kino"

if (!accountId || !apiToken) {
  console.log(
    "Skipping stale Cloudflare preview cleanup: missing CLOUDFLARE_ACCOUNT_ID/CF_ACCOUNT_ID or CLOUDFLARE_API_TOKEN/CF_API_TOKEN."
  )
  process.exit(0)
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

async function cloudflareFetch(url, init = {}, { throwOnError = true } = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  })
  const body = await response.json().catch(() => null)

  if (!response.ok || body?.success === false) {
    const message =
      body?.errors?.map((error) => error.message).join("; ") ??
      `${response.status} ${response.statusText}`
    if (!throwOnError) {
      return { ok: false, message, status: response.status }
    }
    throw new Error(message)
  }

  return { ok: true, body }
}

const encodedWorkerName = encodeURIComponent(workerName)
const scriptsVersionsUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${encodedWorkerName}/versions`
const workerVersionsUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/workers/${encodedWorkerName}/versions`

async function listWorkerVersions() {
  const versions = []
  let cursor

  do {
    const url = new URL(scriptsVersionsUrl)
    if (cursor) url.searchParams.set("cursor", cursor)

    const { body } = await cloudflareFetch(url)
    const result = body.result
    const items = Array.isArray(result?.items)
      ? result.items
      : Array.isArray(result)
        ? result
        : []

    versions.push(...items)
    cursor = body.result_info?.cursor
  } while (cursor)

  return versions
}

async function deleteVersion(version) {
  return cloudflareFetch(
    `${workerVersionsUrl}/${encodeURIComponent(version.id)}`,
    { method: "DELETE" },
    { throwOnError: false }
  )
}

const activeAliases = new Set(
  listRemoteBranches().map((branch) => previewName(branch, 40))
)
const versions = await listWorkerVersions()
const stalePreviewVersions = versions.filter((version) => {
  const alias = version.annotations?.["workers/alias"]
  return alias && !activeAliases.has(alias)
})

if (stalePreviewVersions.length === 0) {
  console.log(
    `No stale Cloudflare preview Worker versions found for worker '${workerName}'.`
  )
  process.exit(0)
}

const mode = shouldDelete ? "Deleting" : "Dry run: would delete"
console.log(
  `${mode} ${stalePreviewVersions.length} stale Cloudflare preview Worker version(s) for worker '${workerName}'.`
)

for (const version of stalePreviewVersions) {
  const alias = version.annotations?.["workers/alias"]
  const createdAt =
    version.created_on ?? version.created_at ?? version.metadata?.created_on
  const suffix = createdAt ? ` created ${createdAt}` : ""

  if (!shouldDelete) {
    console.log(`- ${version.id} alias='${alias}'${suffix}`)
    continue
  }

  const result = await deleteVersion(version)
  if (result.ok) {
    console.log(`Deleted ${version.id} alias='${alias}'.`)
    continue
  }

  if (result.message.includes("latest version cannot be deleted")) {
    console.warn(
      `Skipped ${version.id} alias='${alias}': latest Worker version cannot be deleted yet. Rerun after a newer deployment.`
    )
    continue
  }

  console.warn(
    `Could not delete ${version.id} alias='${alias}': ${result.message}`
  )
}

if (!shouldDelete) {
  console.log("Run again with --delete to delete these versions.")
}
