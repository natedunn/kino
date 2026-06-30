import { execSync } from "node:child_process"
import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"
import tailwindcss from "@tailwindcss/vite"
import { cloudflare } from "@cloudflare/vite-plugin"

const port = process.env.PORT ? Number(process.env.PORT) : undefined
const uploadPostHogSourcemaps = Boolean(
  process.env.POSTHOG_CLI_API_KEY &&
  process.env.POSTHOG_CLI_HOST &&
  process.env.POSTHOG_CLI_PROJECT_ID
)

// Stable identifier for the deployed build, baked into both the client and
// server bundles. Lets a long-lived (stale) tab detect that a newer version has
// been deployed and prompt a reload. Prefer the CI commit SHA, fall back to the
// local git SHA, then a build timestamp.
//
// IMPORTANT: this must resolve to the SAME value for the client and server
// bundles of a given deploy. That holds because it runs once per `vite build`
// process and `define` injects the single literal into both. If the build is
// ever split across separate processes, the commit-SHA paths stay stable but
// the `Date.now()` fallback would diverge between bundles — making client and
// server ids permanently mismatch and showing the reload toast on every load.
function resolveBuildId(): string {
  const fromEnv =
    process.env.WORKERS_CI_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.VITE_BUILD_ID
  if (fromEnv) return fromEnv.slice(0, 12)

  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim()
  } catch {
    return `t${Date.now()}`
  }
}

const config = defineConfig({
  build: {
    // The app shell is code-split below 500 kB, but React 19 + ReactDOM's
    // production client runtime lands in a stable vendor chunk above Vite's
    // default 500 kB warning threshold. Keep the warning meaningful for chunks
    // that grow beyond the intentional framework/runtime ceiling.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("/node_modules/")) return

          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) {
            return "vendor-react"
          }
        },
      },
    },
    sourcemap: uploadPostHogSourcemaps,
  },
  define: {
    __KINO_BUILD_ID__: JSON.stringify(resolveBuildId()),
  },
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  server: {
    ...(process.env.HOST ? { host: process.env.HOST } : {}),
    ...(Number.isFinite(port) ? { port, strictPort: true } : {}),
  },
  test: {
    // convex-test must be inlined so its module graph runs in the test runtime.
    // Per-file environment is set via a `// @vitest-environment edge-runtime`
    // docblock on the convex-test suites (others stay on the default env).
    server: { deps: { inline: ["convex-test"] } },
    // convex-test mutation invocations pay a one-time cold-start (better-auth
    // init + module loading) that can exceed the default 5s on first run.
    testTimeout: 30_000,
  },
})

export default config
