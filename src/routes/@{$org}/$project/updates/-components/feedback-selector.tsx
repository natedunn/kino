import { useDeferredValue, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, Plus, Search, X } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { StatusIcon } from "@/icons"
import LoaderQuarter from "@/icons/loader-quarter"
import { useCRPC } from "@/lib/convex/crpc"
import { cn } from "@/lib/utils"

export function FeedbackSelector({
  projectId,
  selectedIds,
  onChange,
}: {
  onChange: (ids: string[]) => void
  projectId: string
  selectedIds: string[]
}) {
  const crpc = useCRPC()
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const deferredSearchTerm = useDeferredValue(searchTerm)

  const { data: searchResults, isLoading: isSearching } = useQuery(
    crpc.feedback.searchForLinking.queryOptions(
      { projectId, search: deferredSearchTerm },
      { enabled: open }
    )
  )

  const { data: selectedItems = [] } = useQuery(
    crpc.feedback.getByIds.queryOptions(
      { ids: selectedIds },
      { enabled: selectedIds.length > 0 }
    )
  )

  const handleSelect = (feedbackId: string) => {
    if (selectedIds.includes(feedbackId)) {
      onChange(selectedIds.filter((id) => id !== feedbackId))
    } else {
      onChange([...selectedIds, feedbackId])
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      setSearchTerm("")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {selectedItems.length > 0 ? (
        <div className="flex flex-col gap-2">
          {selectedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-md border bg-muted/30 p-3"
            >
              <StatusIcon colored size="16" status={item.status} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{item.title}</div>
                {item.board ? (
                  <div className="text-xs text-muted-foreground">
                    {item.board.name}
                  </div>
                ) : null}
              </div>
              <button
                aria-label={`Remove ${item.title}`}
                className="rounded p-1 hover:bg-muted"
                onClick={() =>
                  onChange(selectedIds.filter((id) => id !== item.id))
                }
                type="button"
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogTrigger
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium whitespace-nowrap ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          )}
        >
          <Plus className="h-4 w-4" />
          Link Feedback
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Link Related Feedback</DialogTitle>
            <DialogDescription>
              Search and select feedback items that are addressed by this
              update.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-9"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search feedback..."
              value={searchTerm}
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto rounded-md border">
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <LoaderQuarter className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : searchResults && searchResults.length > 0 ? (
              <div className="flex flex-col">
                {searchResults.map((item) => {
                  const isSelected = selectedIds.includes(item.id)
                  return (
                    <button
                      key={item.id}
                      className={cn(
                        "flex items-center gap-3 border-b p-3 text-left transition-colors last:border-b-0 hover:bg-muted/50",
                        isSelected && "bg-muted/30"
                      )}
                      onClick={() => handleSelect(item.id)}
                      type="button"
                    >
                      <div
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded border",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/30"
                        )}
                      >
                        {isSelected ? <Check className="h-3 w-3" /> : null}
                      </div>
                      <StatusIcon colored size="16" status={item.status} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{item.title}</div>
                        {item.board ? (
                          <div className="text-xs text-muted-foreground">
                            {item.board.name}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {deferredSearchTerm
                  ? "No feedback found."
                  : "Type to search feedback..."}
              </div>
            )}
          </div>

          {selectedIds.length > 0 ? (
            <div className="text-sm text-muted-foreground">
              {selectedIds.length} item{selectedIds.length !== 1 ? "s" : ""}{" "}
              selected
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
