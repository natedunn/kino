import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const checkboxVariants = cva(
  "peer inline-flex shrink-0 items-center justify-center rounded-[4px] border-2 border-muted-foreground/40 bg-background shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground dark:aria-invalid:ring-destructive/40 dark:data-[checked]:bg-primary",
  {
    variants: {
      size: {
        xs: "size-3.5 [&_svg]:size-2.5",
        sm: "size-4 [&_svg]:size-3",
        default: "size-[18px] [&_svg]:size-3",
        lg: "size-[22px] rounded-[5px] [&_svg]:size-4",
        xl: "size-6 rounded-md [&_svg]:size-4",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

function Checkbox({
  className,
  size,
  ...props
}: Omit<React.ComponentProps<typeof CheckboxPrimitive.Root>, "size"> &
  VariantProps<typeof checkboxVariants>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      data-size={size}
      className={cn(checkboxVariants({ size, className }))}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
      >
        <CheckIcon strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox, checkboxVariants }
