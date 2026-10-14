import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import {
  findLiveSupervisors,
  liveSessionMessage,
  listProcesses,
  ownerOf,
  processCwd,
  readDevSessionState,
  selectOrphanGroups,
  selectOrphanedDevPids,
  selectRecordedGroups,
} from "./dev-session.mjs"
import { isShareOwnerCommand, readShareOwnerPid } from "./dev-share.mjs"

export function anonymousEnvFilePath(workspaceRoot) {
  return path.join(workspaceRoot, ".convex", "anonymous.env")
}

export function projectLocalStateDir(workspaceRoot) {
  return path.join(workspaceRoot, ".convex", "local", "default")
}

export function projectLocalConfigPath(workspaceRoot) {
  return path.join(projectLocalStateDir(workspaceRoot), "config.json")
}

export function parseEnvValue(value) {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }

  const commentIndex = trimmed.search(/\s+#/)
  return (commentIndex === -1 ? trimmed : trimmed.slice(0, commentIndex)).trim()
}

export function readEnvFile(filePath) {
  const env = {}
  if (!fs.existsSync(filePath)) return env

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    // Support both `KEY=value` and `export KEY=value` (shell-sourced env files).
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    env[match[1]] = parseEnvValue(match[2])
  }

  return env
}

export function readLocalEnv(workspaceRoot) {
  return {
    ...readEnvFile(path.join(workspaceRoot, ".env")),
    ...readEnvFile(path.join(workspaceRoot, ".env.local")),
  }
}

export function anonymousConvexEnv(env = process.env) {
  const result = {
    ...env,
    CONVEX_AGENT_MODE: "anonymous",
    CONVEX_DEPLOYMENT: "anonymous-agent",
  }
  // Delete rather than set to "" — some CLI tools distinguish between an empty
  // string and an absent key, and leaving these set can cause auth failures.
  delete result.CONVEX_DEPLOY_KEY
  delete result.CONVEX_DEPLOYMENT_TOKEN
  delete result.CONVEX_SELF_HOSTED_URL
  delete result.CONVEX_SELF_HOSTED_ADMIN_KEY
  return result
}

export function ensureAnonymousEnvFile(workspaceRoot) {
  const envPath = anonymousEnvFilePath(workspaceRoot)
  fs.mkdirSync(path.dirname(envPath), { recursive: true })
  fs.writeFileSync(
    envPath,
    [
      "# Used by the Convex CLI to avoid reusing .env.local's shared dev deployment.",
      "CONVEX_DEPLOYMENT=anonymous-agent",
      "",
    ].join("\n")
  )
}

export function configuredLocalBackendPort(workspaceRoot) {
  const configPath = projectLocalConfigPath(workspaceRoot)
  if (!fs.existsSync(configPath)) return null

  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"))
    const port = config?.ports?.cloud
    return Number.isInteger(port) ? port : null
  } catch {
    return null
  }
}

function hashString(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function* preferredLocalBackendPorts(workspaceRoot) {
  const hash = hashString(workspaceRoot)
  // Keep this band well above portless, which picks its own free Vite backend
  // port in the low thousands (~4000-5000) and force-kills whatever occupies it.
  // Overlapping ranges let portless evict a worktree's Convex backend.
  //
  // Stay below 32768 so we also clear the Linux default ephemeral range
  // (32768-60999): 20000 + (6000-1)*2 = 31998 site 31999, leaving the whole band
  // free of both portless and OS-assigned outbound ports on macOS and Linux.
  const firstCloudPort = 20000
  const pairCount = 6000
  const offset = hash % pairCount

  for (let attempt = 0; attempt < pairCount; attempt += 1) {
    const cloud = firstCloudPort + ((offset + attempt) % pairCount) * 2
    yield {
      cloud,
      site: cloud + 1,
    }
  }
}

function portIsAvailableForWorkspace(port, workspaceRoot) {
  const stateDir = projectLocalStateDir(workspaceRoot)
  const pids = localBackendPids(port, workspaceRoot)
  return (
    pids.length === 0 ||
    pids.every((pid) => processCommand(pid, workspaceRoot).includes(stateDir))
  )
}

function portHasWorkspaceBackend(port, workspaceRoot) {
  const stateDir = projectLocalStateDir(workspaceRoot)
  return localBackendPids(port, workspaceRoot).some((pid) =>
    processCommand(pid, workspaceRoot).includes(stateDir)
  )
}

// Returns true when the file was actually rewritten, false when it already had
// the desired values (idempotent — avoids needless churn on .env.local).
function updateEnvFileValues(filePath, values) {
  const original = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8")
    : ""
  const lines = original === "" ? [] : original.split(/\r?\n/)
  const seen = new Set()
  const updated = lines.map((line) => {
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)(=.*)$/)
    if (!match || !(match[1] in values)) return line

    seen.add(match[1])
    return `${match[1]}=${values[match[1]]}`
  })

  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key)) updated.push(`${key}=${value}`)
  }

  while (updated.length > 0 && updated.at(-1) === "") updated.pop()
  const next = `${updated.join("\n")}\n`
  if (next === original) return false
  fs.writeFileSync(filePath, next)
  return true
}

// Decide which local backend ports this worktree should use, WITHOUT writing
// anything. Returns { cloud, site } or null. Pure/read-only so callers (e.g. a
// --dry-run sweep) can preview the decision.
export function resolveWorktreeLocalBackendPorts(workspaceRoot) {
  const configPath = projectLocalConfigPath(workspaceRoot)
  if (!fs.existsSync(configPath)) return null

  let config
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"))
  } catch {
    return null
  }

  const configuredCloud = config?.ports?.cloud
  const configuredSite = config?.ports?.site
  const configuredPortsAreUsable =
    Number.isInteger(configuredCloud) &&
    Number.isInteger(configuredSite) &&
    portIsAvailableForWorkspace(configuredCloud, workspaceRoot) &&
    portIsAvailableForWorkspace(configuredSite, workspaceRoot)
  const configuredPortsHaveRunningWorkspaceBackend =
    Number.isInteger(configuredCloud) &&
    Number.isInteger(configuredSite) &&
    (portHasWorkspaceBackend(configuredCloud, workspaceRoot) ||
      portHasWorkspaceBackend(configuredSite, workspaceRoot))

  // Only keep the configured ports if a backend for this worktree is already
  // bound there, or they already equal this worktree's deterministic hashed
  // pair. Otherwise re-derive. This prevents stale/legacy clustered ports (many
  // worktrees stuck on 3210-3218) from sticking around and colliding when
  // several worktrees run `pnpm dev` concurrently.
  const preferred = preferredLocalBackendPorts(workspaceRoot).next().value
  const configuredMatchesPreferred =
    Boolean(preferred) &&
    configuredCloud === preferred.cloud &&
    configuredSite === preferred.site

  let ports =
    configuredPortsAreUsable &&
    (configuredPortsHaveRunningWorkspaceBackend || configuredMatchesPreferred)
      ? { cloud: configuredCloud, site: configuredSite }
      : null

  if (!ports) {
    for (const candidate of preferredLocalBackendPorts(workspaceRoot)) {
      if (
        portIsAvailableForWorkspace(candidate.cloud, workspaceRoot) &&
        portIsAvailableForWorkspace(candidate.site, workspaceRoot)
      ) {
        ports = { cloud: candidate.cloud, site: candidate.site }
        break
      }
    }
  }

  return ports ?? null
}

export function ensureWorktreeLocalBackendPorts(workspaceRoot) {
  const configPath = projectLocalConfigPath(workspaceRoot)
  if (!fs.existsSync(configPath)) return null

  let config
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"))
  } catch {
    return null
  }

  const ports = resolveWorktreeLocalBackendPorts(workspaceRoot)
  if (!ports) return null

  // Only rewrite config.json when the ports actually change — avoids reformatting
  // (and churning git status for) worktrees that are already correct.
  if (config?.ports?.cloud !== ports.cloud || config?.ports?.site !== ports.site) {
    config.ports = { ...(config.ports ?? {}), ...ports }
    fs.writeFileSync(configPath, `${JSON.stringify(config)}\n`)
  }

  // updateEnvFileValues is idempotent (no write when values already match).
  updateEnvFileValues(path.join(workspaceRoot, ".env.local"), {
    CONVEX_DEPLOYMENT: "anonymous:anonymous-agent",
    VITE_CONVEX_URL: `http://127.0.0.1:${ports.cloud}`,
    VITE_CONVEX_SITE_URL: `http://127.0.0.1:${ports.site}`,
  })

  return ports
}

export function localBackendPids(port, workspaceRoot = process.cwd()) {
  if (process.platform === "win32") return []

  const result = spawnSync("lsof", ["-ti", `tcp:${port}`], {
    cwd: workspaceRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })

  if (result.status !== 0 || !result.stdout.trim()) return []

  return [
    ...new Set(
      result.stdout
        .trim()
        .split(/\s+/)
        .map((pid) => Number(pid))
        .filter(Number.isInteger)
    ),
  ]
}

export function processCommand(pid, workspaceRoot = process.cwd()) {
  const result = spawnSync("ps", ["-p", String(pid), "-o", "command="], {
    cwd: workspaceRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })

  return result.status === 0 ? result.stdout.trim() : ""
}

export function localBackendPidsForWorkspace(workspaceRoot) {
  const port = configuredLocalBackendPort(workspaceRoot)
  if (port === null) return { port: null, pids: [] }

  const stateDir = projectLocalStateDir(workspaceRoot)
  const pids = localBackendPids(port, workspaceRoot).filter((pid) =>
    processCommand(pid, workspaceRoot).includes(stateDir)
  )

  return { port, pids }
}

// Reuse a single buffer across all sleep() calls to avoid allocating a fresh
// SharedArrayBuffer on every invocation.
const _sleepBuffer = new Int32Array(new SharedArrayBuffer(4))

export function sleep(ms) {
  Atomics.wait(_sleepBuffer, 0, 0, ms)
}

export function waitForPidsToStop(pids, timeoutMs) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const stillRunning = pids.filter((pid) => {
      try {
        process.kill(pid, 0)
        return true
      } catch {
        return false
      }
    })

    if (stillRunning.length === 0) return true
    sleep(250)
  }

  return false
}

export function waitForLocalBackendToStop(port, timeoutMs, workspaceRoot) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (localBackendPids(port, workspaceRoot).length === 0) return true
    sleep(250)
  }
  return localBackendPids(port, workspaceRoot).length === 0
}

export function waitForLocalBackendToStart(port, timeoutMs, workspaceRoot) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (localBackendPids(port, workspaceRoot).length > 0) {
      sleep(750)
      return true
    }
    sleep(250)
  }
  return localBackendPids(port, workspaceRoot).length > 0
}

export function terminatePids(pids, signal) {
  for (const pid of pids) {
    try {
      process.kill(pid, signal)
    } catch {
      // Process is already gone.
    }
  }
}

function pidIsAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function signalGroups(pgids, signal) {
  for (const pgid of pgids) {
    try {
      process.kill(-pgid, signal)
    } catch {
      // Group is already gone.
    }
  }
}

// Live `pnpm dev` supervisors for this worktree (recorded in the session state
// file, or found by command + working directory for sessions started by older
// code). Never includes the calling process.
export function liveDevSupervisors(workspaceRoot) {
  if (process.platform === "win32") return []
  return findLiveSupervisors({
    processes: listProcesses(),
    state: readDevSessionState(workspaceRoot),
    workspaceRoot,
    cwdOf: processCwd,
    selfPid: process.pid,
  })
}

// The live `pnpm dev:share` process for this worktree, or null.
export function liveDevShareOwner(workspaceRoot) {
  const ownerPid = readShareOwnerPid(workspaceRoot)
  if (ownerPid === null || ownerPid === process.pid) return null
  if (!isShareOwnerCommand(processCommand(ownerPid, workspaceRoot))) return null
  return processCwd(ownerPid) === workspaceRoot ? ownerPid : null
}

// Print the standard "already running" message and return true when a live dev
// session owns this worktree, so callers can refuse instead of killing it.
export function refuseIfDevSessionRunning(workspaceRoot, logPrefix = "[dev]") {
  const live = liveDevSupervisors(workspaceRoot)
  if (live.length === 0) return false
  console.error(`${logPrefix} ${liveSessionMessage(live)}.`)
  return true
}

export function stopLocalBackendForWorkspace(
  workspaceRoot,
  { logPrefix = "[convex]", failOnStubborn = false } = {}
) {
  const { port, pids } = localBackendPidsForWorkspace(workspaceRoot)
  if (port === null || pids.length === 0) return true

  // Never silently take the backend away from a running `pnpm dev`.
  const processes = listProcesses()
  const byPid = new Map(processes.map((proc) => [proc.pid, proc]))
  const sessionOwned = pids.filter(
    (pid) => byPid.has(pid) && ownerOf(pid, byPid, workspaceRoot) === "supervisor"
  )
  if (sessionOwned.length > 0) {
    const live = liveDevSupervisors(workspaceRoot)
    console.error(
      `${logPrefix} this worktree's local Convex backend (pid ${sessionOwned.join(
        ", "
      )}) belongs to a running dev session; ${
        live.length > 0 ? liveSessionMessage(live) : "stop it with `pnpm dev:stop` first"
      }.`
    )
    return false
  }

  console.log(
    `${logPrefix} stopping this worktree's local Convex backend on port ${port}: ${pids.join(
      ", "
    )}`
  )

  terminatePids(pids, "SIGTERM")
  if (waitForPidsToStop(pids, 5000)) return true

  const remaining = localBackendPidsForWorkspace(workspaceRoot).pids
  terminatePids(remaining, "SIGKILL")
  const stopped = waitForPidsToStop(remaining, 2000)

  if (!stopped && failOnStubborn) {
    console.error(
      `${logPrefix} port ${port} is still occupied by this worktree. Stop pnpm dev and rerun.`
    )
  }

  return stopped
}

function terminateAndWait(pids) {
  if (pids.length === 0) return
  terminatePids(pids, "SIGTERM")
  if (waitForPidsToStop(pids, 5000)) return
  const remaining = pids.filter(pidIsAlive)
  terminatePids(remaining, "SIGKILL")
  waitForPidsToStop(remaining, 2000)
}

// Reap dev processes of THIS worktree that were orphaned by a previous,
// non-gracefully stopped `pnpm dev` (or `pnpm dev:share`).
//
// The supervisor spawns Convex (and Vite via portless) detached, so when the
// shell or agent app force-stops `pnpm dev` without a clean SIGTERM, the `convex dev`
// CLI, its local backend, Vite, workerd, and the portless client get reparented
// to launchd and keep running. Orphaned `convex dev` processes whose backend is
// gone retry forever, and they accumulate one stack per run.
//
// Only genuine orphans are reaped: a process is skipped when a live dev
// supervisor (a running session) or any other live non-dev process (a shell
// running `vite build`/`vite preview`, `wrangler dev`, `convex:local:init`, …)
// is above it in the process tree. Matching is pinned to this worktree's exact
// root (see `classifyDevCommand`), and the shared portless proxy daemon is
// never a candidate. Recorded child process groups of a dead supervisor are
// signalled too, so their non-matching intermediates (pnpm/sh) go with them.
//
// Returns the list of pids it signalled (empty when nothing matched).
export function stopStaleWorktreeProcesses(workspaceRoot) {
  if (process.platform === "win32") return []

  const processes = listProcesses()
  const state = readDevSessionState(workspaceRoot)
  const exclude = [process.pid, process.ppid]
  const victims = selectOrphanedDevPids({
    processes,
    workspaceRoot,
    excludePids: exclude,
  })

  const ownPgid = processes.find((proc) => proc.pid === process.pid)?.pgid
  const excludePgids = [...exclude, ...(ownPgid ? [ownPgid] : [])]

  // A recorded supervisor that is gone leaves its groups unowned; orphaned
  // groups led by a dev wrapper (pnpm run dev:vite) go too.
  const staleGroups = [
    ...new Set([
      ...(state && !pidIsAlive(state.supervisorPid)
        ? selectRecordedGroups({ state, processes, workspaceRoot })
        : []),
      ...selectOrphanGroups({
        processes,
        orphanPids: victims,
        workspaceRoot,
        excludePgids,
      }),
    ]),
  ].filter((pgid) => !excludePgids.includes(pgid))
  signalGroups(staleGroups, "SIGTERM")

  terminateAndWait(victims)
  const survivors = listProcesses()
  signalGroups(
    staleGroups.filter((pgid) => survivors.some((proc) => proc.pgid === pgid)),
    "SIGKILL"
  )
  return victims
}

// Stop this worktree's live dev session (if any) on purpose — `pnpm dev:stop`.
// The supervisor gets SIGTERM so it can shut its children down itself; anything
// left afterwards is an orphan and is reaped by `stopStaleWorktreeProcesses`.
// Returns the supervisor pids that were stopped.
export function stopLiveDevSession(workspaceRoot) {
  if (process.platform === "win32") return []

  const supervisors = liveDevSupervisors(workspaceRoot)
  if (supervisors.length === 0) return []

  const state = readDevSessionState(workspaceRoot)
  const groups =
    state && supervisors.includes(state.supervisorPid)
      ? selectRecordedGroups({ state, processes: listProcesses(), workspaceRoot })
      : []

  terminatePids(supervisors, "SIGTERM")
  if (!waitForPidsToStop(supervisors, 5000)) {
    terminatePids(supervisors.filter(pidIsAlive), "SIGKILL")
    waitForPidsToStop(supervisors, 2000)
  }

  // The supervisor SIGTERMs its groups on the way out; repeat in case it was
  // force-killed, then give them a moment before the orphan sweep escalates.
  signalGroups(groups, "SIGTERM")
  return supervisors
}
