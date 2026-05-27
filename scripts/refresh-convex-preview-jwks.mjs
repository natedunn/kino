#!/usr/bin/env node
import { spawnSync } from "node:child_process"

const previewName = process.argv[2]

if (!previewName) {
  console.error("Usage: refresh-convex-preview-jwks.mjs <preview-name>")
  process.exit(1)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  })

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(redactSecretOutput(result.stdout))
    if (result.stderr) process.stderr.write(redactSecretOutput(result.stderr))
    process.exit(result.status ?? 1)
  }

  return result.stdout
}

function redactSecretOutput(output) {
  return output
    .replace(/"envLine"\s*:\s*"JWKS=[^"]*"/g, '"envLine":"JWKS=[REDACTED]"')
    .replace(/"jwks"\s*:\s*"[^"]*"/g, '"jwks":"[REDACTED]"')
    .replace(/"privateKey"\s*:\s*"[^"]*"/g, '"privateKey":"[REDACTED]"')
}

function parseRunOutput(output, functionName) {
  const trimmed = output.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed)
  } catch {
    const lines = trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)

    for (let i = lines.length - 1; i >= 0; i -= 1) {
      try {
        return JSON.parse(lines[i])
      } catch {
        // Continue scanning for Convex's final JSON value line.
      }
    }
  }

  console.error(`Failed to parse ${functionName} JSON output.`)
  process.exit(1)
}

console.log(`Refreshing Convex JWKS for preview '${previewName}'...`)

const targetArgs = ["--preview-name", previewName]

run("npx", [
  "convex",
  "run",
  ...targetArgs,
  "generated/auth:rotateKeys",
  "{}",
])

const output = run("npx", [
  "convex",
  "run",
  ...targetArgs,
  "generated/auth:getLatestJwks",
  "{}",
])

const jwksValue = parseRunOutput(output, "generated/auth:getLatestJwks")
const jwks =
  typeof jwksValue === "string" ? jwksValue : JSON.stringify(jwksValue)

if (typeof jwks !== "string" || jwks.length === 0) {
  console.error("generated/auth:getLatestJwks did not return a JWKS value.")
  process.exit(1)
}

const setOutput = run("npx", [
  "convex",
  "env",
  ...targetArgs,
  "set",
  "JWKS",
  jwks,
])

if (setOutput.trim()) {
  process.stdout.write(setOutput)
}
