// Ownership-aware bookkeeping for `pnpm dev` sessions.
//
// The dev supervisor records itself and the process groups it spawns in a
// per-worktree state file. Everything that kills dev processes (supervisor
// startup, `pnpm dev:stop`, `pnpm dev:share`, `pnpm convex:local:init`) uses the
// helpers below to decide WHAT it may kill:
//
//   - A live supervisor for this worktree is never killed implicitly. Startup
//     and init refuse instead; only `pnpm dev:stop` stops it, deliberately.
//   - Other dev processes are reaped only when they are genuinely orphaned: no
//     live supervisor (or any other live, non-dev process such as a shell,
//     `wrangler dev`, or `vite build`) sits above them in the process tree.
//   - Matching is scoped to this worktree's exact root, so a worktree nested
//     under it (e.g. `.claude/worktrees/...`) or a sibling sharing a path prefix
//     is never matched.
//   - The shared portless proxy daemon is never a candidate.
//
// The decision logic is kept pure (process table + state in, pids out) so it
// can be unit tested without spawning or killing anything.

import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

export const SUPERVISOR_COMMAND_RE = /(?:^|[\s/])scripts\/dev-supervisor\.mjs(?:\s|$)/

export function devStateDir(workspaceRoot) {
  return path.join(os.tmpdir(), "kino-dev", path.basename(workspaceRoot))
}

export function devSessionStatePath(workspaceRoot) {
  return path.join(devStateDir(workspaceRoot), "dev-session.json")
}

// ---------------------------------------------------------------------------
// State file
// ---------------------------------------------------------------------------

export function parseDevSessionState(text, workspaceRoot) {
  try {
    const state = JSON.parse(text)
    if (!state || state.workspaceRoot !== workspaceRoot) return null
    if (!Number.isInteger(state.supervisorPid) || state.supervisorPid <= 1) {
      return null
    }
    const children = Array.isArray(state.children)
      ? state.children.filter(
          (child) =>
            child &&
            typeof child.name === "string" &&
            Number.isInteger(child.pgid) &&
            child.pgid > 1
        )
      : []
    return {
      workspaceRoot,
      supervisorPid: state.supervisorPid,
      startedAt: typeof state.startedAt === "string" ? state.startedAt : null,
      mode: typeof state.mode === "string" ? state.mode : null,
      children,
    }
  } catch {
    return null
  }
}

export function readDevSessionState(workspaceRoot) {
  const statePath = devSessionStatePath(workspaceRoot)
  if (!fs.existsSync(statePath)) return null
  try {
    return parseDevSessionState(fs.readFileSync(statePath, "utf8"), workspaceRoot)
  } catch {
    return null
  }
}

export function writeDevSessionState(workspaceRoot, state) {
  const statePath = devSessionStatePath(workspaceRoot)
  fs.mkdirSync(path.dirname(statePath), { recursive: true })
  const tmpPath = `${statePath}.${process.pid}.tmp`
  fs.writeFileSync(
    tmpPath,
    `${JSON.stringify({ ...state, workspaceRoot }, null, 2)}\n`
  )
  fs.renameSync(tmpPath, statePath)
}

// Only clears the file when it still belongs to `supervisorPid`, so a stale
// supervisor exiting late can never erase a newer session's record.
export function clearDevSessionState(workspaceRoot, supervisorPid) {
  const state = readDevSessionState(workspaceRoot)
  if (supervisorPid !== undefined && state && state.supervisorPid !== supervisorPid) {
    return
  }
  fs.rmSync(devSessionStatePath(workspaceRoot), { force: true })
}

// ---------------------------------------------------------------------------
// Process table
// ---------------------------------------------------------------------------

export function parseProcessTable(output) {
  const processes = []
  for (const line of output.split("\n")) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/)
    if (!match) continue
    processes.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      pgid: Number(match[3]),
      command: match[4],
    })
  }
  return processes
}

export function listProcesses() {
  if (process.platform === "win32") return []
  const result = spawnSync("ps", ["-axww", "-o", "pid=,ppid=,pgid=,command="], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
  if (result.status !== 0 || !result.stdout) return []
  return parseProcessTable(result.stdout)
}

export function processCwd(pid) {
  if (process.platform === "win32") return null
  const result = spawnSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
  if (result.status !== 0 || !result.stdout) return null
  const line = result.stdout.split("\n").find((entry) => entry.startsWith("n"))
  return line ? line.slice(1) : null
}

// ---------------------------------------------------------------------------
// Command classification
// ---------------------------------------------------------------------------

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function normalizeRoot(workspaceRoot) {
  return workspaceRoot.length > 1 && workspaceRoot.endsWith(path.sep)
    ? workspaceRoot.slice(0, -1)
    : workspaceRoot
}

export function isSupervisorCommand(command) {
  return SUPERVISOR_COMMAND_RE.test(command)
}

// Classifies a command line as one of this worktree's dev-session processes.
// Returns the kind ("convex" | "backend" | "vite" | "workerd" | "portless") or
// null. Binaries must live directly under `<root>/node_modules/` (or, for the
// backend, use `<root>/.convex/local/default` as storage), which pins the match
// to this exact worktree: nested worktrees and prefix-sharing siblings differ.
export function classifyDevCommand(command, workspaceRoot) {
  const root = escapeRegExp(normalizeRoot(workspaceRoot))
  const modules = `${root}/node_modules/\\S*?`

  // The shared portless proxy daemon serves every worktree; never touch it.
  if (/\/portless\/\S*cli\.js\s+proxy\b/.test(command)) return null

  if (new RegExp(`${modules}/convex/bin/main\\.js\\s+dev(?:\\s|$)`).test(command)) {
    return "convex"
  }
  if (
    command.includes("convex-local-backend") &&
    new RegExp(`${root}/\\.convex/local/default(?:/|\\s|$)`).test(command)
  ) {
    return "backend"
  }
  // `vite` and `vite dev`/`vite serve` are the dev server. `vite build`,
  // `vite preview`, and `vite optimize` are someone else's work.
  if (
    new RegExp(`${modules}/vite/bin/vite\\.js(?:\\s+(?:dev|serve)\\b|\\s+-|\\s*$)`).test(
      command
    )
  ) {
    return "vite"
  }
  if (new RegExp(`${modules}/workerd\\s+serve\\b`).test(command)) return "workerd"
  // The client shape used by scripts/dev-portless.sh: `portless <name> --force …`
  // (never a management subcommand such as `prune` or `list`).
  const portlessSubcommands = "proxy|service|get|alias|list|trust|clean|prune|hosts|run"
  if (
    new RegExp(
      `${modules}/portless/\\S*cli\\.js\\s+(?!(?:${portlessSubcommands})\\s)\\S+\\s+--force\\b`
    ).test(command)
  ) {
    return "portless"
  }
  return null
}

// Processes that sit between the supervisor and a dev process but carry no
// worktree path of their own.
export function isDevIntermediateCommand(command) {
  return (
    /\bpnpm(?:\.c?js)?\s+(?:run\s+)?dev:vite\b/.test(command) ||
    /(?:^|\s)(?:\/\S*\/)?sh\s+scripts\/dev-portless\.sh\b/.test(command)
  )
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

// Supervisors for this worktree that are alive right now: the recorded one (if
// it is still a dev-supervisor running in this worktree) plus any unrecorded
// supervisor started by older code. `cwdOf` returns a pid's working directory.
export function findLiveSupervisors({
  processes,
  state,
  workspaceRoot,
  cwdOf,
  selfPid,
}) {
  const root = normalizeRoot(workspaceRoot)
  const live = []
  for (const proc of processes) {
    if (proc.pid === selfPid || !isSupervisorCommand(proc.command)) continue
    const cwd = cwdOf(proc.pid)
    if (cwd !== null && normalizeRoot(cwd) === root) live.push(proc.pid)
  }
  // Keep the recorded supervisor first so messages name the canonical session.
  if (state && live.includes(state.supervisorPid)) {
    return [state.supervisorPid, ...live.filter((pid) => pid !== state.supervisorPid)]
  }
  return live
}

// Walk up from a dev process and decide who owns it:
//   "supervisor" — a live dev-supervisor is an ancestor (a running session),
//   "foreign"    — some other live process owns it (shell, wrangler, init, …),
//   "orphan"     — the chain reaches init through dev processes only.
export function ownerOf(pid, byPid, workspaceRoot) {
  const seen = new Set()
  let current = byPid.get(pid)
  while (current) {
    if (seen.has(current.pid)) return "foreign"
    seen.add(current.pid)
    const parentPid = current.ppid
    if (parentPid <= 1) return "orphan"
    const parent = byPid.get(parentPid)
    // The parent vanished between `ps` columns; treat as reparented.
    if (!parent) return "orphan"
    if (isSupervisorCommand(parent.command)) return "supervisor"
    if (
      classifyDevCommand(parent.command, workspaceRoot) === null &&
      !isDevIntermediateCommand(parent.command)
    ) {
      return "foreign"
    }
    current = parent
  }
  return "orphan"
}

// Dev processes of this worktree that no live session or other process owns.
export function selectOrphanedDevPids({ processes, workspaceRoot, excludePids = [] }) {
  const byPid = new Map(processes.map((proc) => [proc.pid, proc]))
  const exclude = new Set(excludePids)
  const victims = []
  for (const proc of processes) {
    if (exclude.has(proc.pid)) continue
    if (classifyDevCommand(proc.command, workspaceRoot) === null) continue
    if (ownerOf(proc.pid, byPid, workspaceRoot) === "orphan") victims.push(proc.pid)
  }
  return victims
}

// Process groups led by an orphaned dev process or a dev intermediate (e.g. the
// `pnpm run dev:vite` that leads Vite's group), so reaping an orphan also takes
// the wrapper that carries no worktree path of its own.
export function selectOrphanGroups({
  processes,
  orphanPids,
  workspaceRoot,
  excludePgids = [],
}) {
  const byPid = new Map(processes.map((proc) => [proc.pid, proc]))
  const exclude = new Set(excludePgids)
  const groups = new Set()
  for (const pid of orphanPids) {
    const pgid = byPid.get(pid)?.pgid
    if (!pgid || pgid <= 1 || exclude.has(pgid)) continue
    const leader = byPid.get(pgid)
    if (
      leader &&
      (classifyDevCommand(leader.command, workspaceRoot) !== null ||
        isDevIntermediateCommand(leader.command)) &&
      ownerOf(leader.pid, byPid, workspaceRoot) === "orphan"
    ) {
      groups.add(pgid)
    }
  }
  return [...groups]
}

// Recorded child process groups that still contain one of this worktree's dev
// processes (guards against signalling a recycled pgid).
export function selectRecordedGroups({ state, processes, workspaceRoot }) {
  if (!state) return []
  return state.children
    .map((child) => child.pgid)
    .filter((pgid) =>
      processes.some(
        (proc) =>
          proc.pgid === pgid &&
          (classifyDevCommand(proc.command, workspaceRoot) !== null ||
            isDevIntermediateCommand(proc.command))
      )
    )
}

export function liveSessionMessage(pids) {
  const list = pids.join(", ")
  return `dev is already running in this worktree (pid ${list}); stop it with \`pnpm dev:stop\` first`
}
