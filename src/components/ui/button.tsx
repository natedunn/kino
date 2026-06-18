import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1 rounded-md text-sm font-medium whitespace-nowrap outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 disabled:grayscale aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default:
          "border border-blue-500 bg-gradient-to-tl from-primary to-blue-400 text-background dark:border-blue-300 dark:text-foreground hocus:border-blue-800 hocus:to-blue-600 hocus:dark:border-blue-400",
        destructive: [
          "border bg-gradient-to-tl",
          "border-red-800 from-red-500 via-red-700 to-red-700 text-red-50",
          "hocus:border-red-900 hocus:from-red-600 hocus:via-red-800 hocus:to-red-800 hocus:text-background",
          "dark:border-red-400 dark:from-red-500 dark:via-red-700 dark:to-red-700",
          "hocus:dark:border-red-500 hocus:dark:from-red-600 hocus:dark:via-red-800 hocus:dark:to-red-800 hocus:dark:text-red-50",
        ],
        outline: [
          "border border-foreground/30 bg-gradient-to-tl hover:bg-accent",
          "from-muted via-white to-white",
          "hocus:border-foreground/30 hocus:from-muted hocus:via-muted hocus:to-white",
          "dark:border-foreground/15 dark:from-foreground/10 dark:via-foreground/5 dark:to-foreground/5",
          "hocus:dark:!border-foreground/10 hocus:dark:!from-transparent hocus:dark:!via-transparent hocus:dark:!to-foreground/10",
          "active:dark:bg-foreground/10",
        ],
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: [
          "border border-transparent bg-gradient-to-tl from-transparent to-transparent hocus:text-accent-foreground",
          "hocus:border-foreground/20 hocus:from-accent/50 hocus:via-white hocus:to-white",
          "hocus:dark:border-foreground/10 hocus:dark:from-foreground/20 hocus:dark:via-foreground/10 hocus:dark:to-foreground/5",
        ],
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  asChild = false,
  className,
  variant = "default",
  size = "default",
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      nativeButton={!asChild}
      render={asChild && React.isValidElement(children) ? children : undefined}
      {...props}
    >
      {asChild ? undefined : children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
