import { useContext, useEffect } from "react"

import { ShortcutsContext } from "./shortcuts-context"
import type { Shortcut } from "./types"

export function useShortcuts() {
  const context = useContext(ShortcutsContext)

  if (!context) {
    throw new Error("useShortcuts must be used within ShortcutsProvider")
  }

  return {
    close: context.close,
    open: context.open,
    toggle: context.toggle,
  }
}

/**
 * Registers a set of page-specific keyboard shortcuts for the lifetime of the
 * calling component, keyed by `scopeId` (re-registering the same scope replaces
 * it). Shortcuts are surfaced in the "?" shortcuts modal and matched globally
 * (unless focus is inside an editable element).
 *
 * IMPORTANT: `shortcuts` is compared by reference. Always pass a memoized array
 * (e.g. `useMemo`) — an inline array re-registers on every render, which loops
 * provider state updates and re-renders the whole tree.
 */
export function useRegisterShortcuts(
  scopeId: string,
  shortcuts: Array<Shortcut>
) {
  const context = useContext(ShortcutsContext)

  if (!context) {
    throw new Error("useRegisterShortcuts must be used within ShortcutsProvider")
  }

  useEffect(() => {
    return context.registerShortcuts(scopeId, shortcuts)
  }, [context.registerShortcuts, scopeId, shortcuts])
}
