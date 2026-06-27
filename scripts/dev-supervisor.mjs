import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  anonymousConvexEnv,
  anonymousEnvFilePath as getAnonymousEnvFilePath,
  configuredLocalBackendPort,
  ensureWorktreeLocalBackendPorts,
  ensureAnonymousEnvFile,
  preserveSharedDevDeployment,
  projectLocalConfigPath as getProjectLocalConfigPath,
  readLocalEnv,
  stopLocalBackendForWorkspace,
  stopStaleWorktreeProcesses,
  waitForLocalBackendToStart,
} from "./lib/local-convex.mjs"

const workspaceRoot = process.cwd()
const binDir = path.join(workspaceRoot, "node_modules", ".bin")
const kitcnCmd = path.join(
  binDir,
  process.platform === "win32" ? "kitcn.cmd" : "kitcn"
)
const convexCmd = path.join(
  binDir,
  process.platform === "win32" ? "convex.cmd" : "convex"
)
const shellCmd = process.platform === "win32" ? "sh.exe" : "sh"
const logDir = path.join(os.tmpdir(), "kino-dev", path.basename(workspaceRoot))
const convexMode = process.env.KINO_CONVEX_MODE ?? "anonymous"
const anonymousEnvFilePath = getAnonymousEnvFilePath(workspaceRoot)
const projectLocalConfigPath = getProjectLocalConfigPath(workspaceRoot)

fs.mkdirSync(logDir, { recursive: true })

function startProcess(name, command, args, env = process.env) {
  const logPath = path.join(logDir, `${name}.log`)
  const logFd = fs.openSync(logPath, "w")
  const child = spawn(command, args, {
    stdio: ["ignore", logFd, logFd],
    detached: true,
    env,
    cwd: workspaceRoot,
  })
  fs.closeSync(logFd)

  child.on("error", (error) => {
    console.error(`[${name}] failed to start:`, error)
  })

  const tail = spawn("tail", ["-n", "+1", "-f", logPath], {
    stdio: "inherit",
    env,
    cwd: workspaceRoot,
  })

  return { child, tail }
}

function prepareAnonymousConvex() {
  // Reap Convex/Vite/portless processes orphaned by a previous, non-gracefully
  // stopped `pnpm dev` of this worktree. Otherwise orphaned `convex dev` CLIs
  // (whose backend is gone) retry forever and spam the console, and they pile up
  // one stack per run.
  const reaped = stopStaleWorktreeProcesses(workspaceRoot)
  if (reaped.length > 0) {
    console.log(
      `[dev] reaped ${reaped.length} stale dev process(es) from a previous run: ${reaped.join(
        ", "
      )}`
    )
  }

  preserveSharedDevDeployment(workspaceRoot, "scripts/dev-supervisor.mjs")
  ensureAnonymousEnvFile(workspaceRoot)

  if (!fs.existsSync(projectLocalConfigPath)) {
    console.warn(
      "[convex] anonymous local backend is not seeded yet. Run scripts/helmor-worktree-setup.sh to initialize and seed this worktree before dev."
    )
    return
  }

  stopLocalBackendForWorkspace(workspaceRoot)
  const ports = ensureWorktreeLocalBackendPorts(workspaceRoot)
  if (ports) {
    console.log(
      `[convex] using worktree-local Convex ports ${ports.cloud}/${ports.site}`
    )
  }
}

function convexDevArgs() {
  if (convexMode !== "anonymous") return ["dev"]

  const args = [
    "dev",
    "--env-file",
    path.relative(workspaceRoot, anonymousEnvFilePath),
  ]

  if (fs.existsSync(projectLocalConfigPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(projectLocalConfigPath, "utf8"))
      if (typeof config.backendVersion === "string") {
        args.push("--local-backend-version", config.backendVersion)
      }
    } catch {
      // Fall back to Convex's default latest-version resolution.
    }
  }

  return args
}

function convexDevCommand() {
  return convexMode === "anonymous" ? convexCmd : kitcnCmd
}

function killProcessGroup(child, signal) {
  if (!child.pid) return

  try {
    process.kill(-child.pid, signal)
  } catch {
    try {
      child.kill(signal)
    } catch {
      // Process is already gone.
    }
  }
}

if (convexMode === "anonymous") {
  prepareAnonymousConvex()
} else if (convexMode !== "shared") {
  console.error(
    `Unknown KINO_CONVEX_MODE "${convexMode}". Expected "anonymous" or "shared".`
  )
  process.exit(1)
}

const localEnv = readLocalEnv(workspaceRoot)
const frontendEnv = { ...process.env, ...localEnv }
const convexEnv =
  convexMode === "anonymous" ? anonymousConvexEnv() : { ...process.env }

// Best-effort: register this dev deployment's webhook receiver with the gateway
// fan-out (no-op when gateway env vars are absent, or when the selected Convex
// site URL is local-only).
spawn(
  "node",
  [path.join("scripts", "gateway-webhook-target.mjs"), "register"],
  {
    stdio: "inherit",
    env: frontendEnv,
    cwd: workspaceRoot,
  }
)

const children = []

let shuttingDown = false

function shutdown(signal = "SIGTERM") {
  if (shuttingDown) return
  shuttingDown = true

  for (const { child } of children) {
    killProcessGroup(child, signal)
  }
  for (const { tail } of children) {
    tail.kill("SIGTERM")
  }
}

function exitFromSignal(signal) {
  shutdown(signal)
  process.exit(128 + (signal === "SIGINT" ? 2 : 15))
}

process.on("SIGINT", () => exitFromSignal("SIGINT"))
process.on("SIGTERM", () => exitFromSignal("SIGTERM"))
process.on("exit", () => {
  if (!shuttingDown) {
    shutdown("SIGTERM")
  }
})

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Block Vite until Convex has pushed functions and is actually listening.
// Without this gate the browser connects to a not-yet-ready backend on first
// load and you have to refresh/restart `pnpm dev` a couple times before it
// sticks. Returns "ready" | "exited" | "timeout".
async function waitForConvexReady(logPath, child) {
  const pattern = /Convex functions ready!|Convex ready/i
  const port =
    convexMode === "anonymous" ? configuredLocalBackendPort(workspaceRoot) : null
  const deadlineMs = 120000
  const started = Date.now()

  while (Date.now() - started < deadlineMs) {
    if (child.exitCode !== null || child.signalCode !== null) return "exited"
    if (fs.existsSync(logPath)) {
      try {
        if (pattern.test(fs.readFileSync(logPath, "utf8"))) {
          // Functions are pushed; for a local backend also confirm the port is
          // accepting connections before letting the frontend connect.
          if (port !== null) waitForLocalBackendToStart(port, 5000, workspaceRoot)
          return "ready"
        }
      } catch {
        // Log not readable yet; retry.
      }
    }
    await delay(300)
  }

  return "timeout"
}

// Start Convex first and wait for it, then Vite.
children.push({
  name: "convex",
  ...startProcess("convex", convexDevCommand(), convexDevArgs(), convexEnv),
})

console.log("[dev] waiting for Convex backend before starting Vite…")
const convexLogPath = path.join(logDir, "convex.log")
const readiness = await waitForConvexReady(convexLogPath, children[0].child)

if (readiness === "exited") {
  console.error(`[convex] exited before becoming ready. See ${convexLogPath}`)
  shutdown("SIGTERM")
  process.exit(1)
} else if (readiness === "timeout") {
  console.warn(
    `[dev] Convex not ready after 120s; starting Vite anyway. See ${convexLogPath}`
  )
} else {
  console.log("[dev] Convex backend ready; starting Vite.")
}

children.push({
  name: "vite",
  ...startProcess(
    "vite",
    shellCmd,
    [path.join("scripts", "dev-portless.sh"), "pnpm", "run", "dev:vite"],
    frontendEnv
  ),
})

for (const { name, child } of children) {
  child.on("exit", (code, signal) => {
    if (shuttingDown) return

    shuttingDown = true

    for (const other of children) {
      if (other.child.pid !== child.pid) {
        killProcessGroup(other.child, "SIGTERM")
      }
    }

    if (signal) {
      console.error(`[${name}] exited from ${signal}`)
      process.exit(128 + (signal === "SIGINT" ? 2 : 15))
    }

    process.exit(code ?? 0)
  })
}
