import { execSync } from "node:child_process"
import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"
import tailwindcss from "@tailwindcss/vite"
import { cloudflare } from "@cloudflare/vite-plugin"

const port = process.env.PORT ? Number(process.env.PORT) : undefined

// Stable identifier for the deployed build, baked into both the client and
// server bundles. Lets a long-lived (stale) tab detect that a newer version has
// been deployed and prompt a reload. Prefer the CI commit SHA, fall back to the
// local git SHA, then a build timestamp.
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
})

export default config
