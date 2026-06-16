import * as React from "react"

import { cn } from "@/lib/utils"

function supportsFieldSizing() {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("field-sizing", "content")
  )
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  const ref = React.useRef<HTMLTextAreaElement>(null)

  // Modern browsers auto-grow via the CSS `field-sizing: content` rule below.
  // Firefox and Safari < 17.4 don't support it yet, so fall back to a JS
  // resize listener there. This is a no-op on browsers that do support it.
  React.useEffect(() => {
    const el = ref.current
    if (!el || supportsFieldSizing()) return

    const resize = () => {
      el.style.height = "auto"
      el.style.height = `${el.scrollHeight}px`
    }

    resize()
    el.addEventListener("input", resize)
    return () => el.removeEventListener("input", resize)
  }, [])

  // Keep height in sync when the value is controlled externally.
  React.useEffect(() => {
    const el = ref.current
    if (!el || supportsFieldSizing()) return

    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [props.value])

  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
