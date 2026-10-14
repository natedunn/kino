// Stop THIS worktree's dev session — the recorded `pnpm dev` / `pnpm dev:share`
// supervisor and the Convex CLI, local backend, Vite, workerd, and portless
// client it started — plus any of those processes orphaned by an earlier
// non-graceful stop.
//
// Processes that merely live in this worktree but are not part of a dev session
// (`vite build`, `vite preview`, `wrangler dev` for workers/*, a running
// `convex:local:init`) are left alone, as are worktrees nested under this one.
// The shared portless proxy on :1355 is left running because other worktrees
// route through it.
//
// Usage: pnpm run dev:stop  (from inside the worktree)

import {
  clearSharePidState,
  isOwnedShareCommand,
  readSharePidState,
} from "./lib/dev-share.mjs"
import {
  liveDevShareOwner,
  processCommand,
  stopLiveDevSession,
  stopStaleWorktreeProcesses,
  waitForPidsToStop,
} from "./lib/local-convex.mjs"

const workspaceRoot = process.cwd()

// Ask a live `pnpm dev:share` to shut down itself first so it can unregister
// its gateway origins and webhook target.
const shareOwner = liveDevShareOwner(workspaceRoot)
if (shareOwner !== null) {
  try {
    process.kill(shareOwner, "SIGTERM")
  } catch {
    // Already gone.
  }
  if (!waitForPidsToStop([shareOwner], 20_000)) {
    try {
      process.kill(shareOwner, "SIGKILL")
    } catch {
      // Already gone.
    }
  }
  console.log(`[dev:stop] stopped this worktree's dev:share session (pid ${shareOwner})`)
}

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

const supervisors = stopLiveDevSession(workspaceRoot)
if (supervisors.length > 0) {
  console.log(
    `[dev:stop] stopped this worktree's dev session (supervisor pid ${supervisors.join(", ")})`
  )
}

// Whatever the stopped session (or an earlier crashed one) left behind is now
// orphaned and safe to reap.
const stopped = [
  ...new Set([
    ...(shareOwner === null ? [] : [shareOwner]),
    ...sharePids,
    ...supervisors,
    ...stopStaleWorktreeProcesses(workspaceRoot),
  ]),
]

if (stopped.length > 0) {
  console.log(
    `[dev:stop] stopped ${stopped.length} dev process(es) for this worktree: ${stopped.join(", ")}`
  )
} else {
  console.log("[dev:stop] no dev processes are running for this worktree.")
}
