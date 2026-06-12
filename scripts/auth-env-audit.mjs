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

// Two-tier model (docs/github-environments.md): these keys must be identical
// WITHIN a tier (dev tier: convex-dev + preview defaults + local; prod tier:
// convex-prod + prod defaults) and must NOT be shared ACROSS tiers — the dev
// tier has its own "Kino Auth Dev" OAuth app and its own proxy secret.
const TIER_OAUTH_KEYS = [
  "GITHUB_AUTH_CLIENT_ID",
  "GITHUB_AUTH_CLIENT_SECRET",
  "OAUTH_PROXY_SECRET",
]

const EXPECTED_GATEWAY = {
  dev: "https://gateway-dev.usekino.com",
  prod: "https://gateway.usekino.com",
}

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

function bothSet(envs, key, a, b) {
  return hasValue(envs, key, a) && hasValue(envs, key, b)
}

function collectFindings(envs) {
  const errors = []
  const warnings = []

  for (const key of TIER_OAUTH_KEYS) {
    // Present in each tier's deployments.
    if (!hasValue(envs, key, "convex-dev")) {
      errors.push(`Convex dev is missing ${key}.`)
    }
    if (!hasValue(envs, key, "convex-prod")) {
      errors.push(`Convex prod is missing ${key}.`)
    }
    if (!hasValue(envs, key, "default-preview")) {
      warnings.push(
        `Convex preview defaults are missing ${key}. New preview deployments may drift.`
      )
    }

    // Consistent WITHIN the dev tier (dev deployment + preview defaults + local files).
    if (!sameValue(envs, key, ["convex-dev", "default-preview"])) {
      errors.push(
        `Dev tier mismatch for ${key}: Convex dev and preview defaults differ.`
      )
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

    // Consistent WITHIN the prod tier.
    if (!sameValue(envs, key, ["default-prod", "convex-prod"])) {
      warnings.push(`Convex prod default/deployment differ for ${key}.`)
    }

    // NOT shared ACROSS tiers — dev reusing prod credentials defeats the
    // tier isolation (and vice versa).
    if (
      bothSet(envs, key, "convex-dev", "convex-prod") &&
      sameValue(envs, key, ["convex-dev", "convex-prod"])
    ) {
      errors.push(
        `${key} is identical on Convex dev and prod. Tiers must not share credentials — dev uses the "Kino Auth Dev" app and its own secrets.`
      )
    }
  }

  // The oAuthProxy plugin only mounts when both the secret and the gateway
  // URL are present; a missing URL silently disables GitHub login.
  for (const [name, tier] of [
    ["convex-dev", "dev"],
    ["default-preview", "dev"],
    ["convex-prod", "prod"],
  ]) {
    if (!hasValue(envs, "OAUTH_PROXY_SECRET", name)) continue

    const url = envs[name]?.OAUTH_PROXY_PRODUCTION_URL
    if (!url) {
      errors.push(
        `${name} has OAUTH_PROXY_SECRET but no OAUTH_PROXY_PRODUCTION_URL — the OAuth proxy is disabled and GitHub login will fail there.`
      )
    } else if (url !== EXPECTED_GATEWAY[tier]) {
      warnings.push(
        `${name} OAUTH_PROXY_PRODUCTION_URL is ${url}, expected ${EXPECTED_GATEWAY[tier]}.`
      )
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
