import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

export function anonymousEnvFilePath(workspaceRoot) {
  return path.join(workspaceRoot, ".convex", "anonymous.env")
}

export function sharedDevStatePath(workspaceRoot) {
  return path.join(workspaceRoot, ".convex", "shared-dev-deployment.env")
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

export function preserveSharedDevDeployment(
  workspaceRoot,
  writtenBy = "local Convex workspace setup"
) {
  const localEnv = readLocalEnv(workspaceRoot)
  const configuredDeployment = localEnv.CONVEX_DEPLOYMENT

  if (!configuredDeployment?.startsWith("dev:")) return

  const deploymentName = configuredDeployment.slice("dev:".length)
  const statePath = sharedDevStatePath(workspaceRoot)
  fs.mkdirSync(path.dirname(statePath), { recursive: true })
  fs.writeFileSync(
    statePath,
    [
      `# Written by ${writtenBy} before switching this worktree to anonymous Convex.`,
      `KINO_CONVEX_SEED_SOURCE=${deploymentName}`,
      `CONVEX_DEPLOYMENT=${configuredDeployment}`,
      "",
    ].join("\n")
  )
}

export function ensureAnonymousEnvFile(workspaceRoot) {
  const envPath = anonymousEnvFilePath(workspaceRoot)
  fs.mkdirSync(path.dirname(envPath), { recursive: true })
  fs.writeFileSync(
    envPath,
    [
      "# Used by kitcn/Convex CLI to avoid reusing .env.local's shared dev deployment.",
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
  // Overlapping ranges let portless evict a worktree's Convex backend. 20000+ is
  // clear of that band.
  const firstCloudPort = 20000
  const pairCount = 10000
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

function updateEnvFileValues(filePath, values) {
  const lines = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8").split(/\r?\n/)
    : []
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
  fs.writeFileSync(filePath, `${updated.join("\n")}\n`)
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

  if (!ports) return null

  config.ports = { ...(config.ports ?? {}), ...ports }
  fs.writeFileSync(configPath, `${JSON.stringify(config)}\n`)

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

export function stopLocalBackendForWorkspace(
  workspaceRoot,
  { logPrefix = "[convex]", failOnStubborn = false } = {}
) {
  const { port, pids } = localBackendPidsForWorkspace(workspaceRoot)
  if (port === null || pids.length === 0) return true

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
      `${logPrefix} port ${port} is still occupied by this worktree. Stop pnpm dev/kitcn dev and rerun.`
    )
  }

  return stopped
}
