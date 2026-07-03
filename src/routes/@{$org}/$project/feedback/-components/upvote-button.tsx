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
  const isThisFeedback = mutation.variables?.feedbackId === feedbackId
  const showOptimistic = mutation.isPending && isThisFeedback
  const optimisticHasUpvoted = !initialHasUpvoted
  const optimisticCount = optimisticHasUpvoted
    ? initialCount + 1
    : Math.max(0, initialCount - 1)
  // After the mutation settles there's a brief window before the live query
  // subscription pushes the new value back down through props. Prefer the
  // server-confirmed result during that window so the button doesn't flicker
  // back to the pre-toggle value. The result only "wins" while it still
  // disagrees with props; once props catch up we fall back to them, so a later
  // count change from another viewer isn't masked by a stale result.
  const showResult =
    mutation.isSuccess &&
    isThisFeedback &&
    !!mutation.data &&
    mutation.data.upvoted !== initialHasUpvoted
  const count = showOptimistic
    ? optimisticCount
    : showResult
      ? mutation.data.count
      : initialCount
  const hasUpvoted = showOptimistic
    ? optimisticHasUpvoted
    : showResult
      ? mutation.data.upvoted
      : initialHasUpvoted

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
