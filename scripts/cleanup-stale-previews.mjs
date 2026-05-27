#!/usr/bin/env node

import { execFileSync } from "node:child_process"

const args = process.argv.slice(2)

for (const script of [
  "scripts/cleanup-stale-cloudflare-previews.mjs",
  "scripts/cleanup-stale-convex-previews.mjs",
]) {
  execFileSync("node", [script, ...args], {
    stdio: "inherit",
  })
}
