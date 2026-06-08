import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const workspaceName = path.basename(process.cwd())
const logDir = path.join(os.tmpdir(), "kino-dev", workspaceName)
const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm"

try {
  execFileSync(pnpmCmd, ["exec", "portless", "prune", "--force"], {
    stdio: "inherit",
  })
} catch (error) {
  console.error("Portless prune failed.", error)
  process.exitCode = 1
}

fs.rmSync(logDir, { recursive: true, force: true })
console.log(`Removed dev logs for ${workspaceName}: ${logDir}`)
