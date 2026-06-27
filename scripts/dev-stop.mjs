// Stop every dev process belonging to THIS worktree — the Convex CLI, its local
// backend, Vite, Cloudflare workerd, and the portless client — whether they are
// still running or were orphaned by a non-graceful stop. The shared portless
// proxy on :1355 is left running because other worktrees route through it.
//
// Usage: pnpm run dev:stop  (from inside the worktree)

import { stopStaleWorktreeProcesses } from "./lib/local-convex.mjs"

const workspaceRoot = process.cwd()
const stopped = stopStaleWorktreeProcesses(workspaceRoot)

if (stopped.length > 0) {
  console.log(
    `[dev:stop] stopped ${stopped.length} dev process(es) for this worktree: ${stopped.join(
      ", "
    )}`
  )
} else {
  console.log("[dev:stop] no dev processes are running for this worktree.")
}
