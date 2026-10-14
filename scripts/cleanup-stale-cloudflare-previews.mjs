#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

import {
  CLOUDFLARE_PREVIEW_NAME_LENGTH,
  previewName,
} from "./lib/preview-name.mjs"

loadEnvFiles()

const args = process.argv.slice(2)
const shouldDelete = args.includes("--delete")
const remote =
  getArgValue("--remote") ?? process.env.PREVIEW_CLEANUP_REMOTE ?? "origin"
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const apiToken = process.env.CLOUDFLARE_API_TOKEN
const workerName = process.env.CLOUDFLARE_WORKER_NAME ?? "kino"

if (!accountId || !apiToken) {
  console.log(
    "Skipping stale Cloudflare preview cleanup: missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN."
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

function listRemoteBranches() {
  const output = execFileSync("git", ["ls-remote", "--heads", remote], {
    encoding: "utf8",
  })

  return output
    .split("\n")
    .map((line) => line.trim().match(/refs\/heads\/(.+)$/)?.[1])
    .filter(Boolean)
}

async function cloudflareFetch(url, init = {}) {
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
    throw new Error(message)
  }

  return body
}

function formatCloudflareAuthError(message) {
  if (
    !message.toLowerCase().includes("authentication failed") &&
    !message.toLowerCase().includes("authentication scheme")
  ) {
    return message
  }

  return [
    `Cloudflare API auth failed for account '${accountId}'.`,
    "Use a Cloudflare API Token, not a Global API Key.",
    "The token needs permission to read/delete Workers Scripts for this account.",
    "If the GitHub cleanup action works but this local command fails, your local .env token does not match the GitHub secret.",
    `Original error: ${message}`,
  ].join(" ")
}

// Worker Previews created by `wrangler preview` (scripts/cloudflare-preview-upload.sh).
// This is the same endpoint Wrangler uses for `wrangler preview delete`.
const previewsUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
  accountId
)}/workers/workers/${encodeURIComponent(workerName)}/previews`

async function listWorkerPreviews() {
  const previews = []
  const perPage = 50

  for (let page = 1; ; page++) {
    const url = new URL(previewsUrl)
    url.searchParams.set("page", String(page))
    url.searchParams.set("per_page", String(perPage))

    const body = await cloudflareFetch(url)
    const items = Array.isArray(body?.result) ? body.result : []
    previews.push(...items)

    const totalCount = body?.result_info?.total_count
    if (
      items.length === 0 ||
      (typeof totalCount === "number"
        ? previews.length >= totalCount
        : items.length < perPage)
    ) {
      return previews
    }
  }
}

async function deletePreview(name) {
  await cloudflareFetch(`${previewsUrl}/${encodeURIComponent(name)}`, {
    method: "DELETE",
  })
}

async function main() {
  const activeNames = new Set(
    listRemoteBranches().map((branch) =>
      previewName(branch, CLOUDFLARE_PREVIEW_NAME_LENGTH)
    )
  )
  const previews = await listWorkerPreviews()
  const stalePreviews = previews.filter(
    (preview) => preview?.name && !activeNames.has(preview.name)
  )

  if (stalePreviews.length === 0) {
    console.log(
      `No stale Cloudflare Worker Previews found for worker '${workerName}' (${previews.length} checked).`
    )
    return
  }

  const mode = shouldDelete ? "Deleting" : "Dry run: would delete"
  console.log(
    `${mode} ${stalePreviews.length} of ${previews.length} Cloudflare Worker Preview(s) for worker '${workerName}'.`
  )

  for (const preview of stalePreviews) {
    const updatedAt = preview.deployed_on ?? preview.updated_on ?? preview.created_on
    const suffix = updatedAt ? ` last deployed ${updatedAt}` : ""

    if (!shouldDelete) {
      console.log(`- ${preview.name}${suffix}`)
      continue
    }

    try {
      await deletePreview(preview.name)
      console.log(`Deleted Cloudflare Worker Preview '${preview.name}'.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`Could not delete '${preview.name}': ${message}`)
    }
  }

  if (!shouldDelete) {
    console.log("Run again with --delete to delete these previews.")
  }
}

try {
  await main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(formatCloudflareAuthError(message))
  process.exit(1)
}
