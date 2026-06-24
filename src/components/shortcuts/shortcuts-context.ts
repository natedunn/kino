import { createContext } from "react"

import type { Shortcut } from "./types"

export type ShortcutsContextValue = {
  close: () => void
  open: () => void
  toggle: () => void
  registerShortcuts: (
    scopeId: string,
    shortcuts: Array<Shortcut>
  ) => () => void
}

export const ShortcutsContext = createContext<ShortcutsContextValue | null>(
  null
)
