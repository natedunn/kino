import { useContext, useEffect } from "react"

import { CommandContext } from "./command-context"
import type { AppCommand } from "./types"

export function useCommandPalette() {
  const context = useContext(CommandContext)

  if (!context) {
    throw new Error("useCommandPalette must be used within CommandProvider")
  }

  return {
    close: context.close,
    open: context.open,
  }
}

export function useRegisterCommands(
  scopeId: string,
  commands: Array<AppCommand>
) {
  const context = useContext(CommandContext)

  if (!context) {
    throw new Error("useRegisterCommands must be used within CommandProvider")
  }

  useEffect(() => {
    return context.registerCommands(scopeId, commands)
  }, [commands, context.registerCommands, scopeId])
}
