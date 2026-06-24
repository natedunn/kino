import type { KeyboardEvent as ReactKeyboardEvent } from "react"

/**
 * Groups shown (in this order) inside the keyboard shortcuts modal. Add a new
 * group name here to surface a new page-specific section.
 */
export type ShortcutGroupName = "Global" | "Feedback"

export type ShortcutRunContext = {
  /** The normalized key that matched (lowercase for single letters). */
  key: string
  event: KeyboardEvent
}

export type Shortcut = {
  id: string
  group: ShortcutGroupName
  /**
   * The keys that trigger this shortcut. Single letters are matched
   * case-insensitively; symbols/digits are matched verbatim (e.g. "?", "1").
   * Leave empty for display-only entries (e.g. documenting "⌘K").
   */
  keys: Array<string>
  /**
   * Optional display override for the modal, e.g. "1–9" for a range. Falls back
   * to the `keys` joined together.
   */
  label?: string
  description: string
  run?: (context: ShortcutRunContext) => void | Promise<void>
  /** When provided and returns false, the shortcut is inert and hidden. */
  enabled?: () => boolean
  /** Hide from the modal while still being registered (rare). */
  hidden?: boolean
}

export type ShortcutRegistration = {
  scopeId: string
  shortcuts: Array<Shortcut>
}

export type AnyKeyboardEvent = KeyboardEvent | ReactKeyboardEvent
