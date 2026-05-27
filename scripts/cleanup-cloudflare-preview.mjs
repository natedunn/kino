#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs"

loadEnvFiles()

const alias = process.argv[2]
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? process.env.CF_ACCOUNT_ID
const apiToken = process.env.CLOUDFLARE_API_TOKEN ?? process.env.CF_API_TOKEN
const workerName =
  process.env.CLOUDFLARE_WORKER_NAME ?? process.env.CF_WORKER_NAME ?? "kino"

if (!alias) {
  console.error("Usage: cleanup-cloudflare-preview.mjs <preview-alias>")
  process.exit(1)
}

if (!accountId || !apiToken) {
  console.log(
    "Skipping Cloudflare preview cleanup: missing CLOUDFLARE_ACCOUNT_ID/CF_ACCOUNT_ID or CLOUDFLARE_API_TOKEN/CF_API_TOKEN."
  )
  process.exit(0)
}

const encodedWorkerName = encodeURIComponent(workerName)
const scriptsVersionsUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${encodedWorkerName}/versions`
const workerVersionsUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/workers/${encodedWorkerName}/versions`
const retryDelayMs = Number.parseInt(
  process.env.CLOUDFLARE_CLEANUP_RETRY_DELAY_MS ?? "5000",
  10
)
const maxAttempts = Number.parseInt(
  process.env.CLOUDFLARE_CLEANUP_MAX_ATTEMPTS ?? "6",
  10
)

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
    "The token needs permission to read/delete Worker versions for this account.",
    "If the GitHub cleanup action works but this local command fails, your local .env token does not match the GitHub secret.",
    `Original error: ${message}`,
  ].join(" ")
}

async function listVersions() {
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function deleteMatchingVersions() {
  const versions = await listVersions()
  const matchingVersions = versions.filter(
    (version) => version.annotations?.["workers/alias"] === alias
  )

  if (matchingVersions.length === 0) {
    return { blockedByLatest: false, deleted: 0, found: 0 }
  }

  let blockedByLatest = false
  let deleted = 0

  for (const version of matchingVersions) {
    if (!version.id) continue

    const result = await cloudflareFetch(
      `${workerVersionsUrl}/${encodeURIComponent(version.id)}`,
      { method: "DELETE" },
      { throwOnError: false }
    )

    if (result.ok) {
      deleted += 1
      console.log(
        `Deleted Cloudflare Worker version ${version.id} for preview alias '${alias}'.`
      )
      continue
    }

    if (result.message.includes("latest version cannot be deleted")) {
      blockedByLatest = true
    }

    console.warn(
      `Could not delete Cloudflare Worker version ${version.id} for preview alias '${alias}': ${result.message}`
    )
  }

  return { blockedByLatest, deleted, found: matchingVersions.length }
}

async function main() {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await deleteMatchingVersions()

    if (result.found === 0) {
      console.log(
        `No Cloudflare Worker versions found for preview alias '${alias}' on worker '${workerName}'.`
      )
      return
    }

    if (!result.blockedByLatest) {
      return
    }

    if (attempt < maxAttempts) {
      console.log(
        `Cloudflare still marks a preview version as latest. Retrying cleanup in ${retryDelayMs}ms (${attempt}/${maxAttempts})...`
      )
      await sleep(retryDelayMs)
    }
  }

  console.warn(
    `A Cloudflare Worker version for preview alias '${alias}' is still the latest version and cannot be deleted yet. Rerun cleanup after a newer deployment becomes latest.`
  )
}

try {
  await main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(formatCloudflareAuthError(message))
  process.exit(1)
}
