#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  anonymousConvexEnv,
  anonymousEnvFilePath as getAnonymousEnvFilePath,
  configuredLocalBackendPort,
  ensureWorktreeLocalBackendPorts,
  ensureAnonymousEnvFile,
  localBackendPidsForWorkspace,
  preserveSharedDevDeployment,
  readEnvFile,
  sharedDevStatePath as getSharedDevStatePath,
  sleep,
  stopLocalBackendForWorkspace,
  waitForLocalBackendToStart,
} from "./lib/local-convex.mjs"

const workspaceRoot = process.cwd()
const anonymousEnvFilePath = getAnonymousEnvFilePath(workspaceRoot)
const seedDir = path.join(workspaceRoot, ".agent-contexts", "convex-seed")
const sharedDevStatePath = getSharedDevStatePath(workspaceRoot)
let temporaryLocalBackend = null

const options = parseArgs(process.argv.slice(2))

function parseArgs(args) {
  const parsed = {
    allowCloudTarget: false,
    copyEnv: true,
    envOnly: false,
    includeFileStorage: false,
    skipDeploy: false,
    stopRunningLocal: false,
    source: null,
    target: null,
  }

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === "--") {
      continue
    } else if (arg === "--allow-cloud-target") {
      parsed.allowCloudTarget = true
    } else if (arg === "--env-only") {
      parsed.envOnly = true
    } else if (arg === "--include-file-storage") {
      parsed.includeFileStorage = true
    } else if (arg === "--no-env") {
      parsed.copyEnv = false
    } else if (arg === "--skip-deploy") {
      parsed.skipDeploy = true
    } else if (arg === "--stop-running-local") {
      parsed.stopRunningLocal = true
    } else if (arg === "--source") {
      parsed.source = requireValue(args, ++i, arg)
    } else if (arg === "--target") {
      parsed.target = requireValue(args, ++i, arg)
    } else if (arg === "-h" || arg === "--help") {
      printUsage()
      process.exit(0)
    } else {
      console.error(`Unknown option: ${arg}`)
      printUsage()
      process.exit(1)
    }
  }

  return parsed
}

function requireValue(args, index, optionName) {
  const value = args[index]
  if (!value || value.startsWith("--")) {
    console.error(`${optionName} requires a value.`)
    process.exit(1)
  }
  return value
}

function printUsage() {
  console.log(`Usage: node scripts/seed-convex-from-dev.mjs [options]

Seeds the active anonymous Convex deployment from the shared dev deployment.

Options:
  --source <deployment>       Source deployment to export from. Defaults to the
                              saved shared dev deployment, KINO_CONVEX_SEED_SOURCE,
                              or "dev".
  --target <deployment>       Explicit target deployment. Omit for this worktree's
                              anonymous deployment.
  --include-file-storage      Include Convex file storage in the export/import.
  --no-env                    Do not copy Convex env vars from source to target.
  --env-only                  Copy env vars only; skip data export/import.
  --skip-deploy               Skip the one-shot kitcn bootstrap before import.
  --stop-running-local        Stop an existing anonymous local backend first.
  --allow-cloud-target        Required when --target is not "local".
`)
}

function targetArgs() {
  return options.target ? ["--deployment", options.target] : []
}

function assertTargetIsSafe() {
  if (!options.target) return
  if (options.target === "local") return
  if (options.allowCloudTarget) return

  console.error(
    `Refusing to replace data in explicit target "${options.target}". ` +
      "Pass --allow-cloud-target if this is intentional."
  )
  process.exit(1)
}

function run(
  command,
  args,
  { capture = false, cwd = workspaceRoot, env = process.env } = {}
) {
  console.log(`[seed] ${command} ${args.join(" ")}`)
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env,
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }

  return capture ? result.stdout : ""
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function waitForLogPattern(logPath, pattern, timeoutMs) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (fs.existsSync(logPath)) {
      const contents = fs.readFileSync(logPath, "utf8")
      if (pattern.test(contents)) return true
    }

    if (
      temporaryLocalBackend?.pid &&
      !isProcessRunning(temporaryLocalBackend.pid)
    ) {
      return false
    }

    sleep(250)
  }

  return false
}

function stopTemporaryLocalBackend() {
  const child = temporaryLocalBackend
  if (!child?.pid) return
  temporaryLocalBackend = null

  try {
    if (process.platform === "win32") {
      child.kill("SIGTERM")
    } else {
      process.kill(-child.pid, "SIGTERM")
    }
  } catch {
    try {
      child.kill("SIGTERM")
    } catch {
      // Process is already gone.
    }
  }

  stopLocalBackendForWorkspace(workspaceRoot, { logPrefix: "[seed]" })
}

function startTemporaryLocalBackend(env) {
  if (options.target) return

  const port = configuredLocalBackendPort(workspaceRoot)
  if (port === null) {
    console.error(
      "[seed] could not find this worktree's local Convex port after init."
    )
    process.exit(1)
  }

  const runningBackend = localBackendPidsForWorkspace(workspaceRoot)
  if (runningBackend.pids.length > 0) {
    console.log(
      `[seed] using already-running local Convex backend on port ${port}`
    )
    return
  }

  const logPath = path.join(seedDir, "local-backend.log")
  const logFd = fs.openSync(logPath, "w")
  console.log(
    `[seed] starting temporary local Convex backend for import; logs at ${logPath}`
  )

  temporaryLocalBackend = spawn(
    "pnpm",
    [
      "exec",
      "convex",
      "dev",
      "--env-file",
      path.relative(workspaceRoot, anonymousEnvFilePath),
    ],
    {
      cwd: workspaceRoot,
      detached: process.platform !== "win32",
      env,
      stdio: ["ignore", logFd, logFd],
    }
  )
  fs.closeSync(logFd)

  temporaryLocalBackend.on("exit", (code, signal) => {
    if (temporaryLocalBackend === null) return
    temporaryLocalBackend = null
    console.error(
      `[seed] temporary local Convex backend exited before import finished` +
        ` (code ${code ?? "null"}, signal ${signal ?? "null"}). See ${logPath}.`
    )
    process.exit(code ?? 1)
  })

  if (
    !waitForLogPattern(logPath, /Convex functions ready!|Convex ready/i, 60000)
  ) {
    const logContents = fs.existsSync(logPath)
      ? fs.readFileSync(logPath, "utf8")
      : ""
    console.error(
      `[seed] local Convex backend did not become ready on port ${port}. See ${logPath}.`
    )
    if (logContents.trim()) {
      console.error(logContents.trim().split(/\r?\n/).slice(-20).join("\n"))
    }
    stopTemporaryLocalBackend()
    process.exit(1)
  }

  if (!waitForLocalBackendToStart(port, 5000, workspaceRoot)) {
    console.error(
      `[seed] local Convex backend reported ready, but port ${port} is not listening. See ${logPath}.`
    )
    stopTemporaryLocalBackend()
    process.exit(1)
  }
}

function stopRunningLocalBackendIfRequested() {
  if (!options.stopRunningLocal || options.target) return

  if (
    !stopLocalBackendForWorkspace(workspaceRoot, {
      logPrefix: "[seed]",
      failOnStubborn: true,
    })
  ) {
    process.exit(1)
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

// Learn each app table's allowed top-level fields from the generated
// dataModel.d.ts. The generated file is regularly formatted:
//   <table>: {            // 2-space indent
//     document: {         // 4-space indent
//       <field>?: ...;    // 6-space indent = a direct field
//       <nested>: {       // deeper indent = ignored
//     };
// We collect only the direct children of each `document` block, so dropping a
// column from convex/functions/schema.ts (and regenerating) automatically
// removes it from the allowed set here — no per-field bookkeeping needed.
function parseSchemaFields(dataModelPath) {
  const tables = new Map()
  if (!fs.existsSync(dataModelPath)) return tables

  const lines = fs.readFileSync(dataModelPath, "utf8").split(/\r?\n/)
  let currentTable = null
  let inDocument = false
  let depth = 0

  for (const line of lines) {
    if (!inDocument) {
      const tableMatch = line.match(/^ {2}(\w+): \{$/)
      if (tableMatch) {
        currentTable = tableMatch[1]
      } else if (currentTable && /^ {4}document: \{$/.test(line)) {
        inDocument = true
        depth = 1
        tables.set(currentTable, new Set())
      }
      continue
    }

    if (depth === 1) {
      const fieldMatch = line.match(/^ {6}(\w+)\??:/)
      if (fieldMatch) tables.get(currentTable).add(fieldMatch[1])
    }

    const opens = (line.match(/\{/g) || []).length
    const closes = (line.match(/\}/g) || []).length
    depth += opens - closes
    if (depth <= 0) {
      inDocument = false
      currentTable = null
    }
  }

  return tables
}

// Splice the given top-level keys out of one JSON-object line WITHOUT
// reparsing the kept values. A JSON.parse/stringify round-trip silently
// rewrites Convex's export number encoding — a float64 `0.0` becomes `0`, which
// re-imports as int64 and is then rejected by a v.float64() column. So we walk
// the raw text, drop the targeted `"key":value` segments, and leave every other
// byte (numbers especially) exactly as exported.
function removeTopLevelKeys(line, keysToRemove) {
  let i = 0
  const n = line.length
  const isWs = (ch) => ch === " " || ch === "\t" || ch === "\n" || ch === "\r"
  const skipWs = () => {
    while (i < n && isWs(line[i])) i += 1
  }

  // Advances i past a complete JSON string starting at line[i] === '"'.
  const readString = () => {
    const start = i
    i += 1
    while (i < n) {
      const ch = line[i]
      if (ch === "\\") {
        i += 2
        continue
      }
      i += 1
      if (ch === '"') break
    }
    return JSON.parse(line.slice(start, i))
  }

  // Advances i past one complete JSON value (object/array/string/number/literal).
  const skipValue = () => {
    skipWs()
    const ch = line[i]
    if (ch === '"') {
      readString()
      return
    }
    if (ch === "{" || ch === "[") {
      const open = ch
      const close = ch === "{" ? "}" : "]"
      let depth = 0
      while (i < n) {
        const c = line[i]
        if (c === '"') {
          readString()
          continue
        }
        if (c === open) {
          depth += 1
          i += 1
          continue
        }
        if (c === close) {
          depth -= 1
          i += 1
          if (depth === 0) return
          continue
        }
        i += 1
      }
      return
    }
    // number / true / false / null — read until a structural delimiter.
    while (i < n && !isWs(line[i]) && line[i] !== "," && line[i] !== "}") i += 1
  }

  skipWs()
  if (line[i] !== "{") return { result: line, removed: new Set() }
  i += 1

  const kept = []
  const removed = new Set()
  skipWs()
  if (line[i] === "}") return { result: "{}", removed }

  while (i < n) {
    skipWs()
    const keyStart = i
    const key = readString()
    skipWs()
    i += 1 // ':'
    skipValue()
    const segment = line.slice(keyStart, i)
    if (keysToRemove.has(key)) removed.add(key)
    else kept.push(segment)
    skipWs()
    if (line[i] === ",") {
      i += 1
      continue
    }
    break // closing '}'
  }

  return { result: `{${kept.join(",")}}`, removed }
}

function stripUnknownFields(filePath, allowedFields) {
  if (!fs.existsSync(filePath)) return { rows: 0, removed: new Set() }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/)
  const removed = new Set()
  let changed = 0
  let fileChanged = false
  const out = []

  for (const line of lines) {
    if (!line.trim()) continue

    // Parse only to enumerate keys (read-only); the actual removal is a
    // text-level splice so kept values stay byte-identical.
    const row = JSON.parse(line)
    const toRemove = new Set()
    for (const key of Object.keys(row)) {
      // Convex reserved fields are part of every document type, so they pass
      // the allowed check; guard them anyway so a parser hiccup can't drop them.
      if (key === "_id" || key === "_creationTime") continue
      if (!allowedFields.has(key)) toRemove.add(key)
    }

    if (toRemove.size === 0) {
      out.push(line)
      continue
    }

    const result = removeTopLevelKeys(line, toRemove)
    result.removed.forEach((key) => removed.add(key))
    changed += 1
    fileChanged = true
    out.push(result.result)
  }

  if (fileChanged) fs.writeFileSync(filePath, `${out.join("\n")}\n`)
  return { rows: changed, removed }
}

// Strip any exported field the current schema no longer declares. The shared
// dev ("OG") deployment can be schema-ahead or schema-behind the current
// branch; `convex import --replace-all` rejects unknown fields, so we drop them
// generically rather than maintaining a hardcoded per-field list.
function sanitizeExportForCurrentSchema(exportPath) {
  if (!exportPath.endsWith(".zip")) {
    throw new Error(`[seed] expected a .zip export path, got: ${exportPath}`)
  }

  const dataModelPath = path.join(
    workspaceRoot,
    "convex",
    "functions",
    "_generated",
    "dataModel.d.ts"
  )
  const schemaFields = parseSchemaFields(dataModelPath)
  if (schemaFields.size === 0) {
    console.warn(
      `[seed] could not read generated schema at ${path.relative(
        workspaceRoot,
        dataModelPath
      )}; importing export unchanged. Run \`pnpm codegen\` if import fails on a schema mismatch.`
    )
    return exportPath
  }

  const tempDir = fs.mkdtempSync(path.join(seedDir, "sanitize-"))
  const sanitizedPath = exportPath.replace(/\.zip$/, "-sanitized.zip")

  try {
    run("unzip", ["-q", exportPath, "-d", tempDir])

    let totalRows = 0
    // Only touch tables the app schema owns. Tables present in the export but
    // not in dataModel (e.g. _storage, _tables) are imported verbatim.
    for (const [table, allowedFields] of schemaFields) {
      const docPath = path.join(tempDir, table, "documents.jsonl")
      const { rows, removed } = stripUnknownFields(docPath, allowedFields)
      if (rows > 0) {
        totalRows += rows
        console.log(
          `[seed] ${table}: dropped [${[...removed].sort().join(", ")}] from ` +
            `${rows} row(s) not present in the current schema`
        )
      }
    }

    if (totalRows === 0) return exportPath

    // Start from a clean file so re-runs don't append to a stale archive.
    fs.rmSync(sanitizedPath, { force: true })
    run("zip", ["-q", "-r", sanitizedPath, "."], { cwd: tempDir })
    return sanitizedPath
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

process.on("exit", stopTemporaryLocalBackend)
process.on("SIGINT", () => {
  stopTemporaryLocalBackend()
  process.exit(130)
})
process.on("SIGTERM", () => {
  stopTemporaryLocalBackend()
  process.exit(143)
})

assertTargetIsSafe()
preserveSharedDevDeployment(workspaceRoot, "scripts/seed-convex-from-dev.mjs")
if (!options.target) {
  ensureAnonymousEnvFile(workspaceRoot)
  stopRunningLocalBackendIfRequested()
}
fs.mkdirSync(seedDir, { recursive: true })

const sharedDevState = readEnvFile(sharedDevStatePath)
const sourceDeployment =
  options.source ??
  process.env.KINO_CONVEX_SEED_SOURCE ??
  sharedDevState.KINO_CONVEX_SEED_SOURCE ??
  "dev"
const targetEnv = options.target ? process.env : anonymousConvexEnv()

if (!options.target) {
  run("pnpm", ["exec", "convex", "init"], { env: targetEnv })
  stopRunningLocalBackendIfRequested()
  const ports = ensureWorktreeLocalBackendPorts(workspaceRoot)
  if (ports) {
    console.log(
      `[seed] using worktree-local Convex ports ${ports.cloud}/${ports.site}`
    )
  }
}

if (options.copyEnv) {
  const envPath = path.join(seedDir, `dev-env-${timestamp()}.env`)
  const envContents = run(
    "pnpm",
    ["exec", "convex", "env", "list", "--deployment", sourceDeployment],
    { capture: true }
  )
  fs.writeFileSync(envPath, envContents)

  if (envContents.trim()) {
    run(
      "pnpm",
      [
        "exec",
        "convex",
        "env",
        "set",
        "--from-file",
        envPath,
        "--force",
        ...targetArgs(),
      ],
      { env: targetEnv }
    )
  }
}

if (options.envOnly) {
  process.exit(0)
}

if (!options.skipDeploy && !options.target) {
  run(
    "pnpm",
    [
      "exec",
      "kitcn",
      "dev",
      "--bootstrap",
      "--env-file",
      path.relative(workspaceRoot, anonymousEnvFilePath),
    ],
    { env: targetEnv }
  )
} else if (!options.skipDeploy) {
  console.log("[seed] skipping bootstrap for explicit target")
}

const exportPath = path.join(seedDir, `dev-export-${timestamp()}.zip`)
run("pnpm", [
  "exec",
  "convex",
  "export",
  "--deployment",
  sourceDeployment,
  "--path",
  exportPath,
  ...(options.includeFileStorage ? ["--include-file-storage"] : []),
])
const importPath = sanitizeExportForCurrentSchema(exportPath)

startTemporaryLocalBackend(targetEnv)

run(
  "pnpm",
  [
    "exec",
    "convex",
    "import",
    importPath,
    "--replace-all",
    "--yes",
    ...targetArgs(),
  ],
  { env: targetEnv }
)

// Drop the temporary sanitized archive (if one was produced) now that the
// import has consumed it.
if (importPath !== exportPath) {
  fs.rmSync(importPath, { force: true })
}

stopTemporaryLocalBackend()

console.log(
  `[seed] seeded ${options.target ?? "anonymous"} from ${sourceDeployment}`
)
