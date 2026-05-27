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
    if (result.stderr) process.stderr.write(result.stderr)
    process.exit(result.status ?? 1)
  }

  return result.stdout
}

console.log(`Refreshing Convex JWKS for preview '${previewName}'...`)

const output = run("pnpm", [
  "exec",
  "kitcn",
  "auth",
  "jwks",
  "--rotate",
  "--preview-name",
  previewName,
  "--json",
])

let parsed
try {
  parsed = JSON.parse(output)
} catch {
  console.error("Failed to parse kitcn auth jwks JSON output.")
  process.exit(1)
}

if (typeof parsed.jwks !== "string" || parsed.jwks.length === 0) {
  console.error("kitcn auth jwks did not return a JWKS value.")
  process.exit(1)
}

const setOutput = run("npx", [
  "convex",
  "env",
  "set",
  "JWKS",
  parsed.jwks,
  "--preview-name",
  previewName,
])

if (setOutput.trim()) {
  process.stdout.write(setOutput)
}

