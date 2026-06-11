import { ClickableContainer } from "@/components/clickable-container"
import { StatusIcon } from "@/icons"
import { stripHtml, truncateToNearestSpace } from "@/lib/utils/truncate"

import { UpvoteButton } from "./upvote-button"

export function FeedbackCard({
  onNavigationClick,
  feedback,
  isAuthenticated,
}: {
  onNavigationClick: () => void
  feedback: any
  isAuthenticated: boolean
}) {
  const { title, firstComment, upvotes, board, status, hasUpvoted } = feedback

  return (
    <li className="flex rounded-lg border bg-card">
      <div className="rounded-l-lg border-r bg-accent px-4 pt-4">
        <UpvoteButton
          feedbackId={feedback.id}
          initialCount={upvotes}
          initialHasUpvoted={hasUpvoted}
          isAuthenticated={isAuthenticated}
        />
      </div>
      <ClickableContainer
        className="group flex w-full flex-col rounded-r-lg p-5 transition-colors duration-100 ease-in-out hocus:bg-accent/50 hocus:outline-primary"
        onClick={() => onNavigationClick?.()}
      >
        <div className="flex items-start gap-4">
          <div className="mt-1">
            <StatusIcon colored size="30px" status={status} />
          </div>
          <div>
            <span className="text-xl font-medium underline-offset-2 group-hover:underline">
              {title}
            </span>
            <div className="mt-2 h-full max-h-62.5 space-y-4 overflow-hidden text-sm text-ellipsis text-muted-foreground">
              {truncateToNearestSpace(
                stripHtml(firstComment?.content ?? ""),
                300
              )}
            </div>
            {board ? (
              <div className="mt-8 text-sm text-muted-foreground">
                Filed in <span className="underline">{board.name}</span>
              </div>
            ) : null}
          </div>
        </div>
      </ClickableContainer>
    </li>
  )
}
