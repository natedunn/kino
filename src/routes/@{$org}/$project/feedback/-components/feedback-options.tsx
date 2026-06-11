import { Link, useParams } from "@tanstack/react-router"
import { SquareArrowOutUpRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"

export function FeedbackOptions() {
  const { org, project } = useParams({ from: "/@{$org}/$project/feedback/" })

  return (
    <div className="flex flex-col gap-2">
      <Link
        className={buttonVariants({
          variant: "outline",
          className:
            "group inline-flex! w-full items-center justify-between! text-left",
        })}
        params={{ org, project }}
        to="/@{$org}/$project/settings/boards"
      >
        <span>All boards</span>
        <SquareArrowOutUpRight className="size-4 text-muted-foreground" />
      </Link>
      <Link
        className={buttonVariants({
          variant: "outline",
          className:
            "group inline-flex! w-full items-center justify-between! text-left",
        })}
        params={{ org, project }}
        to="/@{$org}/$project/settings/integrations"
      >
        <span>Integrations</span>
        <SquareArrowOutUpRight className="size-4 text-muted-foreground" />
      </Link>
    </div>
  )
}
