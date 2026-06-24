import { useContext, useEffect, useRef } from "react"

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
 * Registration happens once per `scopeId` (on mount). The provider receives
 * stable proxies whose `run`/`enabled` always delegate to the latest array via
 * a ref, so passing a fresh array each render — even an inline literal — is
 * safe and never loops provider state. The *structural* fields a proxy exposes
 * (keys, label, description) are captured at registration time, so keep those
 * static per scope; only `run`/`enabled` are expected to change over time.
 */
export function useRegisterShortcuts(
  scopeId: string,
  shortcuts: Array<Shortcut>
) {
  const context = useContext(ShortcutsContext)

  if (!context) {
    throw new Error("useRegisterShortcuts must be used within ShortcutsProvider")
  }

  const shortcutsRef = useRef(shortcuts)
  shortcutsRef.current = shortcuts

  const { registerShortcuts } = context

  useEffect(() => {
    const proxies = shortcutsRef.current.map((shortcut, index) => ({
      ...shortcut,
      run: shortcut.run
        ? (ctx: Parameters<NonNullable<Shortcut["run"]>>[0]) =>
            shortcutsRef.current[index]?.run?.(ctx)
        : undefined,
      enabled: shortcut.enabled
        ? () => shortcutsRef.current[index]?.enabled?.() ?? true
        : undefined,
    }))
    return registerShortcuts(scopeId, proxies)
    // Intentionally register once per scope; `run`/`enabled` stay fresh via the
    // ref, so `shortcuts` is deliberately excluded from the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerShortcuts, scopeId])
}
