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

const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}/versions`

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

async function listVersions() {
  const versions = []
  let cursor

  do {
    const url = new URL(baseUrl)
    if (cursor) url.searchParams.set("cursor", cursor)

    const body = await cloudflareFetch(url)
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

const versions = await listVersions()
const matchingVersions = versions.filter(
  (version) => version.annotations?.["workers/alias"] === alias
)

if (matchingVersions.length === 0) {
  console.log(
    `No Cloudflare Worker versions found for preview alias '${alias}' on worker '${workerName}'.`
  )
  process.exit(0)
}

for (const version of matchingVersions) {
  if (!version.id) continue

  await cloudflareFetch(`${baseUrl}/${version.id}`, { method: "DELETE" })
  console.log(
    `Deleted Cloudflare Worker version ${version.id} for preview alias '${alias}'.`
  )
}
