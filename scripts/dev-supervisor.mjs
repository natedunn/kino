import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const workspaceRoot = process.cwd()
const binDir = path.join(workspaceRoot, "node_modules", ".bin")
const kitcnCmd = path.join(binDir, process.platform === "win32" ? "kitcn.cmd" : "kitcn")
const shellCmd = process.platform === "win32" ? "sh.exe" : "sh"
const logDir = path.join(os.tmpdir(), "kino-dev", path.basename(workspaceRoot))

fs.mkdirSync(logDir, { recursive: true })

function startProcess(name, command, args) {
  const logPath = path.join(logDir, `${name}.log`)
  const logFd = fs.openSync(logPath, "w")
  const child = spawn(command, args, {
    stdio: ["ignore", logFd, logFd],
    detached: true,
    env: process.env,
    cwd: workspaceRoot,
  })
  fs.closeSync(logFd)

  child.on("error", (error) => {
    console.error(`[${name}] failed to start:`, error)
  })

  const tail = spawn("tail", ["-n", "+1", "-f", logPath], {
    stdio: "inherit",
    env: process.env,
    cwd: workspaceRoot,
  })

  return { child, tail }
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

// Best-effort: register this dev deployment's webhook receiver with the gateway
// fan-out (no-op when gateway env vars are absent). Convex dev deployments have
// publicly reachable *.convex.site URLs, so GitHub webhooks work locally
// without tunnels.
spawn("node", [path.join("scripts", "gateway-webhook-target.mjs"), "register"], {
  stdio: "inherit",
  env: process.env,
  cwd: workspaceRoot,
})

const children = [
  {
    name: "vite",
    ...startProcess("vite", shellCmd, [
      path.join("scripts", "dev-portless.sh"),
      "pnpm",
      "run",
      "dev:vite",
    ]),
  },
  { name: "convex", ...startProcess("convex", kitcnCmd, ["dev"]) },
]

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
