// Auto-format source with Prettier before a local build. This is the shared
// enforcement point for code produced by any tool — Claude, Codex, or a human —
// so anything that runs `pnpm run build` ends up consistently formatted.
//
// Skipped in CI / Cloudflare deploy builds: `build:cloudflare` ultimately calls
// `pnpm run build` too (see scripts/cloudflare-vite-build.sh), and deploys build
// already-committed source. Reformatting there would waste time and silently
// mask unformatted code that slipped past local builds instead of surfacing it.
import { execSync } from "node:child_process"

const CI_ENV_VARS = [
  "CI",
  "CONVEX_DEPLOY_KEY", // exported by scripts/cloudflare-build.sh before the build
  "WORKERS_CI_BRANCH",
  "CF_PAGES",
  "CF_PAGES_BRANCH",
  "CLOUDFLARE_BRANCH",
  "GITHUB_ACTIONS",
]

const ciVar = CI_ENV_VARS.find((name) => process.env[name])
if (ciVar) {
  console.log(`[format-source] ${ciVar} set — skipping auto-format (deploy build)`)
  process.exit(0)
}

// `pnpm exec` resolves the local prettier binary regardless of how this script
// was launched (via `pnpm run` or a bare `node scripts/format-source.mjs`).
execSync('pnpm exec prettier --write "**/*.{ts,tsx,js,jsx}"', {
  stdio: "inherit",
})
