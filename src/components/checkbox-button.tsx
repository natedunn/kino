import type React from "react"

import { useState } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const checkboxButtonVariants = cva(
  "inline-flex items-center rounded-lg border border-input transition-all duration-200 hover:bg-muted/50 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
  {
    variants: {
      size: {
        xs: "h-6 gap-1.5 rounded-[min(var(--radius-md),10px)] px-2 text-xs",
        sm: "h-7 gap-2 rounded-[min(var(--radius-md),12px)] px-2.5 text-sm",
        default: "min-h-8 gap-2.5 px-3 py-1.5 text-sm",
        lg: "min-h-9 gap-3 px-3.5 py-2 text-sm",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

const checkboxButtonIndicatorVariants = cva(
  "flex items-center justify-center rounded border-2 transition-all duration-200",
  {
    variants: {
      size: {
        xs: "size-3.5 [&_svg]:size-2.5",
        sm: "size-4 [&_svg]:size-3",
        default: "size-5 [&_svg]:size-3",
        lg: "size-5 [&_svg]:size-3.5",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

interface CheckboxButtonProps {
  children: React.ReactNode
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export default function CheckboxButton({
  children,
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
  className,
  size = "default",
}: CheckboxButtonProps & VariantProps<typeof checkboxButtonVariants>) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked)

  const isChecked = checked !== undefined ? checked : internalChecked

  const handleToggle = () => {
    if (disabled) return

    const newChecked = !isChecked

    if (checked === undefined) {
      setInternalChecked(newChecked)
    }

    onChange?.(newChecked)
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={disabled}
      className={cn(
        checkboxButtonVariants({ size }),
        isChecked
          ? "border-primary bg-primary/5"
          : "border-border bg-background hover:border-muted-foreground/20",
        className
      )}
    >
      <span
        data-slot="checkbox-button-indicator"
        className={cn(
          checkboxButtonIndicatorVariants({ size }),
          isChecked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/30 bg-background"
        )}
      >
        {isChecked && <Check />}
      </span>
      {children}
    </button>
  )
}
