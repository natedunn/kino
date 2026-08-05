// Stop every dev process belonging to THIS worktree — the Convex CLI, its local
// backend, Vite, Cloudflare workerd, and the portless client — whether they are
// still running or were orphaned by a non-graceful stop. The shared portless
// proxy on :1355 is left running because other worktrees route through it.
//
// Usage: pnpm run dev:stop  (from inside the worktree)

import { clearSharePidState, isOwnedShareCommand, readSharePidState } from "./lib/dev-share.mjs"
import {
  processCommand,
  stopStaleWorktreeProcesses,
  waitForPidsToStop,
} from "./lib/local-convex.mjs"

const workspaceRoot = process.cwd()
const sharePids = readSharePidState(workspaceRoot).filter((pid) =>
  isOwnedShareCommand(processCommand(pid, workspaceRoot), workspaceRoot)
)
for (const pid of sharePids) {
  try {
    if (process.platform === "win32") process.kill(pid, "SIGTERM")
    else process.kill(-pid, "SIGTERM")
  } catch {
    // Process is already gone.
  }
}
waitForPidsToStop(sharePids, 2000)
for (const pid of sharePids) {
  try {
    if (process.platform === "win32") process.kill(pid, "SIGKILL")
    else process.kill(-pid, "SIGKILL")
  } catch {
    // Process group is already gone.
  }
}
clearSharePidState(workspaceRoot)

const stopped = [...new Set([...sharePids, ...stopStaleWorktreeProcesses(workspaceRoot)])]

if (stopped.length > 0) {
  console.log(
    `[dev:stop] stopped ${stopped.length} dev process(es) for this worktree: ${stopped.join(", ")}`
  )
} else {
  console.log("[dev:stop] no dev processes are running for this worktree.")
}
