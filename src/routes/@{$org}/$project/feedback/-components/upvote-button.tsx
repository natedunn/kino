import { useMutation } from "@tanstack/react-query"
import { ChevronUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useCRPC } from "@/lib/convex/crpc"
import { cn } from "@/lib/utils"

export function UpvoteButton({
  feedbackId,
  initialCount,
  initialHasUpvoted,
  isAuthenticated,
}: {
  feedbackId: string
  initialCount: number
  initialHasUpvoted: boolean
  isAuthenticated: boolean
}) {
  const crpc = useCRPC()
  const mutation = useMutation(crpc.feedbackUpvote.toggle.mutationOptions())
  const mutationResult =
    mutation.variables?.feedbackId === feedbackId ? mutation.data : undefined
  const count = mutationResult?.count ?? initialCount
  const hasUpvoted = mutationResult?.upvoted ?? initialHasUpvoted

  return (
    <Button
      aria-label={hasUpvoted ? "Remove upvote" : "Upvote feedback"}
      className={cn(
        "h-auto flex-col gap-0 px-2 py-1.5",
        hasUpvoted && "text-primary"
      )}
      disabled={!isAuthenticated || mutation.isPending}
      onClick={(event) => {
        event.stopPropagation()
        mutation.mutate({ feedbackId })
      }}
      size="sm"
      type="button"
      variant={hasUpvoted ? "outline" : "ghost"}
    >
      <ChevronUp className={cn("size-4", hasUpvoted && "fill-current")} />
      <span className="text-xs font-bold tabular-nums">{count}</span>
    </Button>
  )
}
