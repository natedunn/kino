// One-time (and re-runnable) sweep that re-spreads every worktree's local Convex
// backend ports onto its deterministic hashed pair. Fixes legacy worktrees whose
// config.json is stuck on a clustered port (e.g. many worktrees on 3210-3218),
// which collide when several run `pnpm dev` at once.
//
// Safe to run repeatedly:
//   - worktrees that already have their preferred ports are left untouched,
//   - worktrees with a live backend bound on their current port are skipped so
//     we never yank a port out from under a running dev server,
//   - worktrees pointed at a shared `dev:` Convex deployment are skipped so the
//     sweep never silently flips them to anonymous mode.
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
  readLocalEnv,
  resolveWorktreeLocalBackendPorts,
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

function portsEqual(a, b) {
  return Boolean(a) && Boolean(b) && a.cloud === b.cloud && a.site === b.site
}

function fmt(ports) {
  return ports ? `${ports.cloud}/${ports.site}` : "?/?"
}

const roots = listWorktreeRoots()
let changedCount = 0
let unchanged = 0
let skipped = 0

for (const root of roots) {
  const configPath = projectLocalConfigPath(root)
  if (!fs.existsSync(configPath)) continue // not a seeded local-backend worktree

  const name = path.basename(root)

  // Never touch a worktree that is pointed at a shared `dev:` deployment — the
  // port rewrite also forces CONVEX_DEPLOYMENT=anonymous, which would silently
  // switch its Convex mode.
  const deployment = readLocalEnv(root).CONVEX_DEPLOYMENT ?? ""
  if (deployment.startsWith("dev:")) {
    console.log(`[respread] ${name}: skipped — shared deployment (${deployment})`)
    skipped += 1
    continue
  }

  const livePort = configuredLocalBackendPort(root)
  if (livePort !== null && localBackendPidsForWorkspace(root).pids.length > 0) {
    console.log(
      `[respread] ${name}: skipped — live backend running on port ${livePort}`
    )
    skipped += 1
    continue
  }

  const before = readConfiguredPorts(root)
  const target = resolveWorktreeLocalBackendPorts(root)
  if (!target) {
    console.log(`[respread] ${name}: skipped — no usable ports found`)
    skipped += 1
    continue
  }

  if (portsEqual(before, target)) {
    unchanged += 1
    continue
  }

  console.log(
    `[respread] ${name}: ${dryRun ? "would re-derive " : ""}${fmt(before)} -> ${fmt(target)}`
  )
  changedCount += 1

  if (!dryRun) ensureWorktreeLocalBackendPorts(root)
}

const verb = dryRun ? "would re-derive" : "rewritten"
console.log(
  `[respread] done${dryRun ? " (dry run)" : ""} — ${changedCount} ${verb}, ${unchanged} already correct, ${skipped} skipped.`
)
