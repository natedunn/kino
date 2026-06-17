import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import type { DayPickerProps } from "react-day-picker"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: DayPickerProps) {
  return (
    <DayPicker
      className={cn("p-3", className)}
      classNames={{
        button_next: cn(
          buttonVariants({ size: "icon-sm", variant: "ghost" }),
          "absolute right-1 top-1 size-7 opacity-70 hover:opacity-100"
        ),
        button_previous: cn(
          buttonVariants({ size: "icon-sm", variant: "ghost" }),
          "absolute left-1 top-1 size-7 opacity-70 hover:opacity-100"
        ),
        caption_label: "text-sm font-medium",
        day: "size-8 p-0 text-center text-sm",
        day_button: cn(
          buttonVariants({ size: "icon-sm", variant: "ghost" }),
          "size-8 font-normal aria-selected:opacity-100"
        ),
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        month: "space-y-4",
        month_caption: "relative flex h-8 items-center justify-center px-8",
        month_grid: "w-full border-collapse space-y-1",
        months: "flex flex-col gap-4",
        nav: "absolute inset-x-3 top-3",
        outside: "text-muted-foreground opacity-50",
        range_end: "rounded-r-md",
        range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        range_start: "rounded-l-md",
        root: cn("relative w-fit", classNames?.root),
        selected:
          "rounded-md bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-accent text-accent-foreground",
        week: "mt-2 flex w-full",
        weekday:
          "w-8 rounded-md text-[0.8rem] font-normal text-muted-foreground",
        weekdays: "flex",
        weeks: "w-full",
        ...classNames,
      }}
      components={{
        Chevron: ({ className: chevronClassName, orientation }) => {
          const Icon =
            orientation === "left"
              ? ChevronLeft
              : orientation === "right"
                ? ChevronRight
                : ChevronDown
          return (
            <Icon
              aria-hidden="true"
              className={cn("size-4", chevronClassName)}
            />
          )
        },
      }}
      showOutsideDays={showOutsideDays}
      {...props}
    />
  )
}

export { Calendar }
