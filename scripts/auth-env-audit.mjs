#!/usr/bin/env node
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

const AUTH_KEYS = [
  "SITE_URL",
  "VITE_CONVEX_URL",
  "VITE_CONVEX_SITE_URL",
  "GITHUB_AUTH_CLIENT_ID",
  "GITHUB_AUTH_CLIENT_SECRET",
  "OAUTH_PROXY_SECRET",
  "OAUTH_PROXY_PRODUCTION_URL",
  "BETTER_AUTH_SECRET",
]

const SECRET_KEYS = new Set([
  "BETTER_AUTH_SECRET",
  "GITHUB_AUTH_CLIENT_SECRET",
  "OAUTH_PROXY_SECRET",
])

const SHARED_OAUTH_KEYS = [
  "GITHUB_AUTH_CLIENT_ID",
  "GITHUB_AUTH_CLIENT_SECRET",
  "OAUTH_PROXY_SECRET",
]

const OPTIONAL_SHARED_KEYS = ["OAUTH_PROXY_PRODUCTION_URL"]

function parseEnvFile(path) {
  const env = {}
  if (!existsSync(path)) return env

  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue

    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[match[1]] = value
  }

  return env
}

function convexEnvFromArgs(args) {
  const output = execFileSync("npx", ["convex", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  const env = {}

  for (const line of output.split(/\r?\n/)) {
    const index = line.indexOf("=")
    if (index < 0) continue
    env[line.slice(0, index)] = line.slice(index + 1)
  }

  return env
}

function convexEnv(args) {
  return convexEnvFromArgs(["env", "list", ...args])
}

function convexDefaultEnv(type) {
  return convexEnvFromArgs(["env", "default", "list", "--type", type])
}

function shortHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12)
}

function displayValue(key, value) {
  if (!value) return "missing"
  if (SECRET_KEYS.has(key)) return `sha256:${shortHash(value)}`
  return value
}

function sameValue(envs, key, names) {
  const present = names
    .map((name) => envs[name]?.[key])
    .filter((value) => typeof value === "string" && value.length > 0)
  if (present.length <= 1) return true
  return new Set(present).size === 1
}

function hasValue(envs, key, name) {
  return typeof envs[name]?.[key] === "string" && envs[name][key].length > 0
}

function printSection(title) {
  console.log(`\n${title}`)
  console.log("-".repeat(title.length))
}

function printEnvTable(envs) {
  printSection("Auth Env Snapshot")
  for (const key of AUTH_KEYS) {
    console.log(`\n${key}`)
    for (const [name, env] of Object.entries(envs)) {
      console.log(`  ${name.padEnd(12)} ${displayValue(key, env[key])}`)
    }
  }
}

function collectFindings(envs) {
  const errors = []
  const warnings = []

  for (const key of SHARED_OAUTH_KEYS) {
    if (!hasValue(envs, key, "convex-dev")) {
      errors.push(`Convex dev is missing ${key}.`)
    }
    if (!hasValue(envs, key, "convex-prod")) {
      errors.push(`Convex prod is missing ${key}.`)
    }
    if (!sameValue(envs, key, ["convex-dev", "convex-prod"])) {
      errors.push(`Convex dev/prod mismatch for ${key}.`)
    }
    if (!hasValue(envs, key, "default-preview")) {
      warnings.push(
        `Convex preview defaults are missing ${key}. New preview deployments may drift.`
      )
    }
    if (!sameValue(envs, key, ["default-preview", "convex-prod"])) {
      errors.push(
        `Convex preview default/prod deployment mismatch for ${key}.`
      )
    }
    if (!sameValue(envs, key, ["default-prod", "convex-prod"])) {
      warnings.push(`Convex prod default/deployment differ for ${key}.`)
    }
    if (
      hasValue(envs, key, "local") &&
      !sameValue(envs, key, ["local", "convex-dev"])
    ) {
      warnings.push(
        `.env.local ${key} differs from Convex dev. Avoid pushing .env.local to Convex for auth.`
      )
    }
    if (
      hasValue(envs, key, "convex.env") &&
      !sameValue(envs, key, ["convex.env", "convex-dev"])
    ) {
      warnings.push(
        `convex/.env ${key} differs from Convex dev. kitcn dev watches convex/.env and can push this value.`
      )
    }
  }

  for (const key of OPTIONAL_SHARED_KEYS) {
    if (!sameValue(envs, key, ["convex-dev", "convex-prod"])) {
      warnings.push(`Convex dev/prod differ for ${key}.`)
    }
    if (
      hasValue(envs, key, "default-preview") &&
      !sameValue(envs, key, ["default-preview", "convex-prod"])
    ) {
      warnings.push(`Convex preview default/prod differ for ${key}.`)
    }
  }

  if (!hasValue(envs, "SITE_URL", "convex-prod")) {
    errors.push("Convex prod is missing SITE_URL.")
  } else if (envs["convex-prod"].SITE_URL !== "https://usekino.com") {
    warnings.push(
      `Convex prod SITE_URL is ${envs["convex-prod"].SITE_URL}, expected https://usekino.com.`
    )
  }

  if (
    hasValue(envs, "VITE_CONVEX_URL", "local") &&
    hasValue(envs, "VITE_CONVEX_SITE_URL", "local")
  ) {
    const expectedSiteUrl = envs.local.VITE_CONVEX_URL.replace(
      /\.convex\.cloud$/,
      ".convex.site"
    )
    if (expectedSiteUrl !== envs.local.VITE_CONVEX_SITE_URL) {
      warnings.push(
        ".env.local VITE_CONVEX_URL and VITE_CONVEX_SITE_URL point at different Convex deployments."
      )
    }
  }

  return { errors, warnings }
}

function printFindings({ errors, warnings }) {
  printSection("Findings")

  if (errors.length === 0 && warnings.length === 0) {
    console.log("OK: no dangerous auth env drift detected.")
    return
  }

  for (const error of errors) {
    console.log(`ERROR: ${error}`)
  }
  for (const warning of warnings) {
    console.log(`WARN: ${warning}`)
  }
}

function main() {
  const envs = {
    local: parseEnvFile(".env.local"),
    "convex.env": parseEnvFile("convex/.env"),
    "default-dev": convexDefaultEnv("dev"),
    "default-preview": convexDefaultEnv("preview"),
    "default-prod": convexDefaultEnv("prod"),
    "convex-dev": convexEnv([]),
    "convex-prod": convexEnv(["--prod"]),
  }

  printEnvTable(envs)
  const findings = collectFindings(envs)
  printFindings(findings)

  if (findings.errors.length > 0) {
    process.exitCode = 1
  }
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
