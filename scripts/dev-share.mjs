#!/usr/bin/env node
import { spawn } from "node:child_process"
import fs from "node:fs"
import net from "node:net"
import os from "node:os"
import path from "node:path"

import {
  appendTunnelOutput,
  clearSharePidState,
  isOwnedShareCommand,
  quickTunnelUrlFromOutput,
  readSharePidState,
  writeSharePidState,
} from "./lib/dev-share.mjs"
import {
  ensureWorktreeLocalBackendPorts,
  processCommand,
  projectLocalConfigPath,
  readLocalEnv,
  stopStaleWorktreeProcesses,
} from "./lib/local-convex.mjs"

const workspaceRoot = process.cwd()
const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
const nodeCmd = process.execPath
const tunnelTimeoutMs = 30_000
const tunnelPrerequisiteTimeoutMs = 5 * 60_000
const refreshIntervalMs = 60 * 60 * 1000
const children = []
const registeredOrigins = new Set()
let shuttingDown = false
let refreshTimer
let activeEnv
let activeSiteUrl

function fail(message) {
  throw new Error(`[share] ${message}`)
}

function checkQuickTunnelConfig() {
  const configDir = path.join(os.homedir(), ".cloudflared")
  for (const filename of ["config.yml", "config.yaml"]) {
    const configPath = path.join(configDir, filename)
    if (fs.existsSync(configPath)) {
      fail(
        `Cloudflare Quick Tunnels do not support ${configPath}. Move it aside for this session, then rerun.`
      )
    }
  }
}

function reserveLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("could not reserve a Vite port")))
        return
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)))
    })
  })
}

function recordChild(name, child) {
  children.push({ child, name })
  writeSharePidState(
    workspaceRoot,
    children.map(({ child: current }) => current.pid).filter(Boolean)
  )
}

function killProcessGroup(child, signal = "SIGTERM") {
  if (!child.pid) return
  try {
    if (process.platform === "win32") child.kill(signal)
    else process.kill(-child.pid, signal)
  } catch {
    // Already stopped.
  }
}

function stopRecordedShareProcesses() {
  for (const pid of readSharePidState(workspaceRoot)) {
    if (!isOwnedShareCommand(processCommand(pid, workspaceRoot), workspaceRoot)) {
      continue
    }
    try {
      if (process.platform === "win32") process.kill(pid, "SIGTERM")
      else process.kill(-pid, "SIGTERM")
    } catch {
      // Process is already gone.
    }
  }
  clearSharePidState(workspaceRoot)
}

function startQuickTunnel(name, port) {
  return new Promise((resolve, reject) => {
    const origin = `http://127.0.0.1:${port}`
    const child = spawn(
      pnpmCmd,
      [
        "--dir",
        workspaceRoot,
        "exec",
        "wrangler",
        "tunnel",
        "quick-start",
        origin,
        "--log-level",
        "info",
      ],
      {
        cwd: workspaceRoot,
        detached: true,
        env: process.env,
        // A non-interactive stdin makes Wrangler accept its default managed
        // cloudflared download on first use instead of leaving a hidden prompt
        // behind our filtered diagnostics.
        stdio: ["ignore", "inherit", "pipe"],
      }
    )
    recordChild(`tunnel:${name}`, child)

    let output = ""
    let settled = false
    let timer
    const armTimeout = (timeoutMs, message) => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (settled) return
        settled = true
        killProcessGroup(child)
        reject(new Error(message))
      }, timeoutMs)
    }
    armTimeout(
      tunnelPrerequisiteTimeoutMs,
      `${name} tunnel prerequisites did not complete within 5 minutes`
    )

    let cloudflaredStarted = false
    const onData = (chunk) => {
      const text = chunk.toString()
      if (!cloudflaredStarted && text.includes("Requesting new quick Tunnel")) {
        cloudflaredStarted = true
        armTimeout(
          tunnelTimeoutMs,
          `${name} tunnel did not become ready within 30 seconds`
        )
      }
      output = appendTunnelOutput(output, text)
      if (process.env.KINO_SHARE_DEBUG === "1") {
        process.stderr.write(`[share:${name}] ${text}`)
      }
      const publicUrl = quickTunnelUrlFromOutput(output)
      if (!publicUrl || settled) return
      settled = true
      clearTimeout(timer)
      resolve({ child, publicUrl })
    }

    child.stderr?.on("data", onData)
    child.once("error", (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    })
    child.once("exit", (code, signal) => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        reject(
          new Error(`${name} tunnel exited before it was ready (${signal ?? `code ${code ?? 1}`})`)
        )
        return
      }
      if (!shuttingDown) {
        console.error(`[share] ${name} tunnel stopped unexpectedly.`)
        void shutdown(1)
      }
    })
  })
}

async function gatewayRequest(env, method, origin) {
  const gatewayUrl = env.GATEWAY_URL.replace(/\/$/, "")
  const response = await fetch(`${gatewayUrl}/dev/share-origins`, {
    body: origin ? JSON.stringify({ origin }) : undefined,
    headers: {
      authorization: `Bearer ${env.GATEWAY_ADMIN_TOKEN}`,
      ...(origin ? { "content-type": "application/json" } : {}),
    },
    method,
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(
      `gateway ${method} /dev/share-origins failed (${response.status})${body ? `: ${body}` : ""}`
    )
  }
}

async function registerOrigin(env, origin) {
  await gatewayRequest(env, "PUT", origin)
  registeredOrigins.add(origin)
}

async function unregisterOrigins(env) {
  await Promise.allSettled(
    [...registeredOrigins].map((origin) => gatewayRequest(env, "DELETE", origin))
  )
  registeredOrigins.clear()
}

function runWebhookTarget(action, env, targetUrl) {
  return new Promise((resolve) => {
    const child = spawn(
      nodeCmd,
      [path.join("scripts", "gateway-webhook-target.mjs"), action, targetUrl],
      { cwd: workspaceRoot, env, stdio: "ignore" }
    )
    child.once("error", () => resolve())
    child.once("exit", () => resolve())
  })
}

async function waitForApp(port, supervisor) {
  const deadline = Date.now() + 150_000
  while (Date.now() < deadline) {
    if (supervisor.exitCode !== null || supervisor.signalCode !== null) {
      fail("the dev supervisor exited before the app became ready")
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        redirect: "manual",
        signal: AbortSignal.timeout(2_000),
      })
      if (response.status > 0) return
    } catch {
      // Keep waiting while Convex, aggregate backfill, and Vite start.
    }
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  fail("the app did not become ready within 150 seconds")
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  if (refreshTimer) clearInterval(refreshTimer)

  for (const { child } of children) killProcessGroup(child)
  await new Promise((resolve) => setTimeout(resolve, 800))
  for (const { child } of children) killProcessGroup(child, "SIGKILL")
  stopStaleWorktreeProcesses(workspaceRoot)
  if (activeEnv && activeSiteUrl) {
    await runWebhookTarget(
      "unregister",
      activeEnv,
      `${activeSiteUrl.replace(/\/$/, "")}/api/github/webhook`
    )
  }
  if (activeEnv) await unregisterOrigins(activeEnv)
  clearSharePidState(workspaceRoot)
  process.exit(exitCode)
}

async function main() {
  checkQuickTunnelConfig()
  stopRecordedShareProcesses()
  stopStaleWorktreeProcesses(workspaceRoot)

  if (!fs.existsSync(projectLocalConfigPath(workspaceRoot))) {
    fail("this worktree's anonymous Convex backend is not initialized; run `nr init` first")
  }
  const ports = ensureWorktreeLocalBackendPorts(workspaceRoot)
  if (!ports) fail("could not reserve this worktree's local Convex ports")

  const localEnv = readLocalEnv(workspaceRoot)
  const env = { ...process.env, ...localEnv }
  if (!env.GATEWAY_URL || !env.GATEWAY_ADMIN_TOKEN) {
    fail("GATEWAY_URL and GATEWAY_ADMIN_TOKEN are required for authenticated sharing")
  }

  await gatewayRequest(env, "GET")
  activeEnv = env
  const appPort = await reserveLoopbackPort()

  console.log("[share] opening temporary Cloudflare tunnels…")
  const appTunnel = await startQuickTunnel("app", appPort)
  const cloudTunnel = await startQuickTunnel("convex-cloud", ports.cloud)
  const siteTunnel = await startQuickTunnel("convex-site", ports.site)
  activeSiteUrl = siteTunnel.publicUrl

  await registerOrigin(env, appTunnel.publicUrl)
  await registerOrigin(env, siteTunnel.publicUrl)
  refreshTimer = setInterval(() => {
    void Promise.all(
      [...registeredOrigins].map((origin) => gatewayRequest(env, "PUT", origin))
    ).catch((error) => {
      console.warn(`[share] could not refresh gateway registrations: ${error.message}`)
    })
  }, refreshIntervalMs)
  refreshTimer.unref()

  const shareEnv = {
    ...env,
    HOST: "127.0.0.1",
    KINO_CONVEX_MODE: "anonymous",
    KINO_SHARE: "1",
    PORT: String(appPort),
    PORTLESS_URL: appTunnel.publicUrl,
    VITE_CONVEX_SITE_URL: siteTunnel.publicUrl,
    VITE_CONVEX_URL: cloudTunnel.publicUrl,
    VITE_SITE_URL: appTunnel.publicUrl,
  }
  const supervisor = spawn(nodeCmd, [path.join("scripts", "dev-supervisor.mjs")], {
    cwd: workspaceRoot,
    detached: true,
    env: shareEnv,
    stdio: "inherit",
  })
  recordChild("supervisor", supervisor)
  supervisor.once("error", (error) => {
    if (!shuttingDown) {
      console.error(`[share] dev supervisor failed: ${error.message}`)
      void shutdown(1)
    }
  })
  supervisor.once("exit", (code) => {
    if (!shuttingDown) void shutdown(code ?? 1)
  })

  await waitForApp(appPort, supervisor)
  console.log("\n[share] Kino is available at:")
  console.log(`[share] ${appTunnel.publicUrl}`)
  console.log("[share] Press Ctrl+C to stop sharing.\n")
}

process.on("SIGINT", () => void shutdown(130))
process.on("SIGTERM", () => void shutdown(143))

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  await shutdown(1)
}
