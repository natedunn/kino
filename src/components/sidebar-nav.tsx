import { ChevronRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SidebarNavGroupProps = {
  /** Optional heading rendered above the list (e.g. "Settings", "Categories"). */
  title?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/**
 * Heading + vertical list container shared by every left-side sidebar nav.
 * Pair with {@link SidebarNavItem} for the individual links/buttons.
 */
export function SidebarNavGroup({
  title,
  children,
  className,
}: SidebarNavGroupProps) {
  return (
    <div className={className}>
      {title ? (
        <h2 className="mx-2 mb-2 text-sm font-bold text-muted-foreground">
          {title}
        </h2>
      ) : null}
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}

type SidebarNavItemProps = {
  /** Marks the item as the active/current selection (filled `bg-muted`). */
  active?: boolean
  /** Optional leading icon. */
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/**
 * Ghost-styled sidebar entry. Render it as the child of a TanStack `<Link>`
 * (route nav) or any element — keeping routing/search-param typing at the call
 * site. When `active`, the ghost gradient flattens to a solid `bg-muted` fill.
 */
export function SidebarNavItem({
  active,
  icon,
  children,
  className,
}: SidebarNavItemProps) {
  return (
    <span
      data-active={active || undefined}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "group inline-flex! w-full items-center justify-start text-left",
        // Active = a contrasty foreground-alpha gradient (deepens on light,
        // lifts on dark), with a soft same-tone border that blends into the fill.
        "data-[active]:pointer-events-none data-[active]:border-foreground/10 data-[active]:from-foreground/8 data-[active]:via-foreground/12 data-[active]:to-foreground/12 data-[active]:text-accent-foreground",
        className
      )}
    >
      {icon ? (
        <span className="mr-auto inline-flex items-center gap-3">
          <span className="opacity-60 transition-opacity group-hover:opacity-100 group-data-[active]:opacity-100">
            {icon}
          </span>
          <span>{children}</span>
        </span>
      ) : (
        <span className="mr-auto">{children}</span>
      )}
      {/* Right-aligned arrow: only visible when active (not on hover). */}
      <ChevronRight
        aria-hidden="true"
        className="size-3 opacity-0 transition-opacity group-data-[active]:opacity-70"
      />
    </span>
  )
}
