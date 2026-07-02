import { Card } from "@/components/ui/card"
import { MOCK_STATS } from "../-overview-mock-data"

const numberFormatter = new Intl.NumberFormat("en-US")

export function OverviewStats() {
  return (
    <div className="flex flex-wrap gap-3">
      {MOCK_STATS.map((stat) => {
        const { Icon } = stat
        return (
          <Card
            key={stat.key}
            className="min-w-36 flex-1 gap-0 rounded-lg py-0 shadow-none transition-colors hover:border-foreground/20"
          >
            <div className="flex flex-col gap-1 p-3.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon className="size-3.5" />
                <span className="truncate text-xs">{stat.label}</span>
              </div>
              <span className="text-2xl font-semibold tabular-nums">
                {numberFormatter.format(stat.value)}
              </span>
              {stat.hint && (
                <span className="text-[11px] text-muted-foreground">
                  {stat.hint}
                </span>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
