import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const QUICK_TUNNEL_URL_RE =
  /https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.trycloudflare\.com(?![a-z0-9.:@-])/i
const SHARE_ENV_KEYS = [
  "HOST",
  "KINO_SHARE",
  "PORT",
  "PORTLESS_URL",
  "VITE_CONVEX_SITE_URL",
  "VITE_CONVEX_URL",
  "VITE_SITE_URL",
]

export function quickTunnelUrlFromOutput(output) {
  const match = output.match(QUICK_TUNNEL_URL_RE)
  if (!match) return null

  try {
    const url = new URL(match[0])
    if (
      url.protocol !== "https:" ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.trycloudflare\.com$/i.test(url.hostname)
    ) {
      return null
    }
    return url.origin.toLowerCase()
  } catch {
    return null
  }
}

export function appendTunnelOutput(previous, chunk, maxLength = 64_000) {
  const next = `${previous}${chunk}`
  return next.length <= maxLength ? next : next.slice(-maxLength)
}

export function isShareMode(processEnv) {
  return processEnv.KINO_SHARE === "1"
}

// The dev gateway accepts `local` GitHub login routes only for a
// `https://*.localhost` app, so a Quick Tunnel session never registers one.
export function shouldRegisterLocalGatewayRoute(processEnv) {
  return !isShareMode(processEnv)
}

export function mergeFrontendEnv(processEnv, localEnv) {
  const result = { ...processEnv, ...localEnv }
  if (!isShareMode(processEnv)) return result

  for (const key of SHARE_ENV_KEYS) {
    if (processEnv[key] !== undefined) result[key] = processEnv[key]
  }
  // `.env.local`'s GitHub route points at this worktree's Portless app and
  // loopback Convex site, which a Quick Tunnel visitor cannot reach. Turn the
  // login button off for this session without rewriting `.env.local`.
  result.VITE_NATIVE_GITHUB_ENABLED = "false"
  return result
}

export function shareStatePath(workspaceRoot) {
  return path.join(os.tmpdir(), "kino-dev", path.basename(workspaceRoot), "share-pids.json")
}

export function writeSharePidState(workspaceRoot, pids, ownerPid = process.pid) {
  const statePath = shareStatePath(workspaceRoot)
  fs.mkdirSync(path.dirname(statePath), { recursive: true })
  fs.writeFileSync(
    statePath,
    `${JSON.stringify({ ownerPid, pids: [...new Set(pids)], workspaceRoot })}\n`
  )
}

function readShareState(workspaceRoot) {
  const statePath = shareStatePath(workspaceRoot)
  if (!fs.existsSync(statePath)) return null

  try {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
    if (state.workspaceRoot !== workspaceRoot || !Array.isArray(state.pids)) {
      return null
    }
    return state
  } catch {
    return null
  }
}

export function readSharePidState(workspaceRoot) {
  const state = readShareState(workspaceRoot)
  if (!state) return []
  return state.pids.filter((pid) => Number.isInteger(pid) && pid > 1)
}

// The `pnpm dev:share` process that wrote the state (null for older state files).
export function readShareOwnerPid(workspaceRoot) {
  const ownerPid = readShareState(workspaceRoot)?.ownerPid
  return Number.isInteger(ownerPid) && ownerPid > 1 ? ownerPid : null
}

export function clearSharePidState(workspaceRoot) {
  fs.rmSync(shareStatePath(workspaceRoot), { force: true })
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Pinned to the exact worktree root: a sibling sharing a prefix (`kino` vs
// `kino-2`) or a worktree nested below this one never matches.
export function isOwnedShareCommand(command, workspaceRoot) {
  const root = escapeRegExp(workspaceRoot)
  return (
    (new RegExp(`--dir\\s+${root}(?:\\s|$)`).test(command) &&
      /\bwrangler\b[\s\S]*\btunnel\b[\s\S]*\bquick-start\b/.test(command)) ||
    new RegExp(`${root}/scripts/dev-supervisor\\.mjs\\b`).test(command)
  )
}

export function isShareOwnerCommand(command) {
  return /(?:^|[\s/])scripts\/dev-share\.mjs(?:\s|$)/.test(command)
}
