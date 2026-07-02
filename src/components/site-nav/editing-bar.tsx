import { cn } from "@/lib/utils"

/**
 * Human display label for a membership/system role. Purely cosmetic — whether a
 * viewer is *allowed* to edit is decided by `permissions.canEdit`
 * (`verifyProjectAccess` / `verifyOrgAccess`), which the nav shells gate on
 * before rendering the bar. This only prettifies the role for that label, with a
 * generic "Editor" fallback for any editor role we don't have a nicer name for.
 */
export function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case "owner":
      return "Owner"
    case "admin":
    case "org:admin":
    case "system:admin":
      return "Admin"
    case "editor":
    case "org:editor":
    case "system:editor":
      return "Editor"
    default:
      return "Editor"
  }
}

// Faint diagonal hatch for the bar background. `--editing-stripe` sets the
// stripe colour; the pill sits on top with an opaque fill + solid border.
const STRIPES =
  "repeating-linear-gradient(-45deg, var(--editing-stripe) 0, var(--editing-stripe) 1px, transparent 1px, transparent 6px)"

type EditingBarProps = {
  className?: string
  role: string
}

/**
 * Thin context band shown directly under the top-level nav on auth-guarded
 * editing pages. Faint diagonal hatch background with a subtle "Editing as
 * {role}" pill — a quiet signifier that you're in an org/project editing view.
 */
export function EditingBar({ className, role }: EditingBarProps) {
  return (
    <div
      aria-label={`Editing as ${role}`}
      className={cn(
        "border-b border-border/60 bg-muted/30 [--editing-stripe:color-mix(in_oklch,var(--foreground)_8%,transparent)]",
        className
      )}
      role="note"
      style={{ backgroundImage: STRIPES }}
    >
      <div className="container flex items-center py-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-2xs">
          <span>
            Editing as <span className="text-foreground">{role}</span>
          </span>
        </span>
      </div>
    </div>
  )
}
