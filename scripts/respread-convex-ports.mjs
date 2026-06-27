// One-time (and re-runnable) sweep that re-spreads every worktree's local Convex
// backend ports onto its deterministic hashed pair. Fixes legacy worktrees whose
// config.json is stuck on a clustered port (e.g. many worktrees on 3210-3218),
// which collide when several run `pnpm dev` at once.
//
// Safe to run repeatedly: worktrees that already match their preferred ports are
// left untouched, and any worktree with a live backend bound on its current port
// is skipped so we never yank a port out from under a running dev server.
//
// Usage: node scripts/respread-convex-ports.mjs [--dry-run]

import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import {
  configuredLocalBackendPort,
  ensureWorktreeLocalBackendPorts,
  localBackendPidsForWorkspace,
  projectLocalConfigPath,
} from "./lib/local-convex.mjs"

const dryRun = process.argv.includes("--dry-run")

function listWorktreeRoots() {
  const result = spawnSync("git", ["worktree", "list", "--porcelain"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })

  if (result.status !== 0 || !result.stdout) {
    console.error(
      "[respread] could not run `git worktree list`. Run this from inside the repo."
    )
    process.exit(1)
  }

  const roots = []
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.match(/^worktree (.+)$/)
    if (match) roots.push(match[1])
  }
  return roots
}

function readConfiguredPorts(workspaceRoot) {
  const configPath = projectLocalConfigPath(workspaceRoot)
  if (!fs.existsSync(configPath)) return null
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"))
    const { cloud, site } = config?.ports ?? {}
    return Number.isInteger(cloud) && Number.isInteger(site)
      ? { cloud, site }
      : null
  } catch {
    return null
  }
}

const roots = listWorktreeRoots()
let rewritten = 0
let skipped = 0
let unchanged = 0

for (const root of roots) {
  const configPath = projectLocalConfigPath(root)
  if (!fs.existsSync(configPath)) continue // not a seeded anonymous worktree

  const name = path.basename(root)
  const before = readConfiguredPorts(root)

  const livePort = configuredLocalBackendPort(root)
  if (livePort !== null && localBackendPidsForWorkspace(root).pids.length > 0) {
    console.log(
      `[respread] ${name}: skipped — live backend running on port ${livePort}`
    )
    skipped += 1
    continue
  }

  if (dryRun) {
    console.log(
      `[respread] ${name}: would re-derive (current ${before?.cloud ?? "?"}/${
        before?.site ?? "?"
      })`
    )
    continue
  }

  const after = ensureWorktreeLocalBackendPorts(root)
  if (!after) {
    console.log(`[respread] ${name}: no usable ports found, left as-is`)
    skipped += 1
    continue
  }

  if (before && before.cloud === after.cloud && before.site === after.site) {
    unchanged += 1
    continue
  }

  console.log(
    `[respread] ${name}: ${before?.cloud ?? "?"}/${before?.site ?? "?"} -> ${
      after.cloud
    }/${after.site}`
  )
  rewritten += 1
}

console.log(
  `[respread] done — ${rewritten} rewritten, ${unchanged} already correct, ${skipped} skipped.`
)
