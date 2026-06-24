import { useMemo } from "react"

import type { Shortcut, ShortcutGroupName } from "./types"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const GROUP_ORDER: Array<ShortcutGroupName> = ["Global", "Feedback"]

type ShortcutsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  shortcuts: Array<Shortcut>
}

export function ShortcutsDialog({
  open,
  onOpenChange,
  shortcuts,
}: ShortcutsDialogProps) {
  const groups = useMemo(() => {
    const byGroup = new Map<ShortcutGroupName, Array<Shortcut>>()

    for (const shortcut of shortcuts) {
      if (shortcut.hidden) continue
      if (shortcut.enabled && !shortcut.enabled()) continue

      const existing = byGroup.get(shortcut.group)
      if (existing) {
        existing.push(shortcut)
      } else {
        byGroup.set(shortcut.group, [shortcut])
      }
    }

    return GROUP_ORDER.flatMap((group) => {
      const items = byGroup.get(group)
      return items && items.length > 0 ? [{ group, items }] : []
    })
  }, [shortcuts])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="-mx-4 -mt-4 rounded-t-xl border-b bg-muted px-4 pt-4 pb-4">
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts available here. Press a single key — no modifiers needed.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          {groups.map(({ group, items }) => (
            <section key={group} className="flex flex-col gap-1">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {group}
              </h3>
              <ul className="flex flex-col">
                {items.map((shortcut) => (
                  <li
                    key={shortcut.id}
                    className="flex items-center justify-between gap-4 py-1.5"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <ShortcutKeys shortcut={shortcut} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ShortcutKeys({ shortcut }: { shortcut: Shortcut }) {
  const tokens = shortcut.label
    ? [shortcut.label]
    : shortcut.keys.map((key) => (key === " " ? "Space" : key))

  return (
    <span className="flex shrink-0 items-center gap-1">
      {tokens.map((token, index) => (
        <kbd
          key={`${shortcut.id}-${token}-${index}`}
          className="inline-flex min-w-6 items-center justify-center rounded border bg-muted px-1.5 py-0.5 font-sans text-xs font-medium text-muted-foreground"
        >
          {token}
        </kbd>
      ))}
    </span>
  )
}
