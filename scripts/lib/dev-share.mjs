import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const QUICK_TUNNEL_URL_RE =
  /https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.trycloudflare\.com(?![a-z0-9.-])/i
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

export function mergeFrontendEnv(processEnv, localEnv) {
  const result = { ...processEnv, ...localEnv }
  if (processEnv.KINO_SHARE !== "1") return result

  for (const key of SHARE_ENV_KEYS) {
    if (processEnv[key] !== undefined) result[key] = processEnv[key]
  }
  return result
}

export function shareStatePath(workspaceRoot) {
  return path.join(os.tmpdir(), "kino-dev", path.basename(workspaceRoot), "share-pids.json")
}

export function writeSharePidState(workspaceRoot, pids) {
  const statePath = shareStatePath(workspaceRoot)
  fs.mkdirSync(path.dirname(statePath), { recursive: true })
  fs.writeFileSync(statePath, `${JSON.stringify({ pids: [...new Set(pids)], workspaceRoot })}\n`)
}

export function readSharePidState(workspaceRoot) {
  const statePath = shareStatePath(workspaceRoot)
  if (!fs.existsSync(statePath)) return []

  try {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
    if (state.workspaceRoot !== workspaceRoot || !Array.isArray(state.pids)) {
      return []
    }
    return state.pids.filter((pid) => Number.isInteger(pid) && pid > 1)
  } catch {
    return []
  }
}

export function clearSharePidState(workspaceRoot) {
  fs.rmSync(shareStatePath(workspaceRoot), { force: true })
}

export function isOwnedShareCommand(command, workspaceRoot) {
  if (!command.includes(workspaceRoot)) return false
  return (
    /\bwrangler\b[\s\S]*\btunnel\b[\s\S]*\bquick-start\b/.test(command) ||
    /scripts\/dev-supervisor\.mjs\b/.test(command)
  )
}
