#!/usr/bin/env node

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
  process.env.CLOUDFLARE_CLEANUP_RETRY_DELAY_MS ?? "10000",
  10
)
const maxAttempts = Number.parseInt(
  process.env.CLOUDFLARE_CLEANUP_MAX_ATTEMPTS ?? "12",
  10
)

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

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const result = await deleteMatchingVersions()

  if (result.found === 0) {
    console.log(
      `No Cloudflare Worker versions found for preview alias '${alias}' on worker '${workerName}'.`
    )
    process.exit(0)
  }

  if (!result.blockedByLatest) {
    process.exit(0)
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
