import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { AlertTriangle, Clock3, RotateCcw, Trash2 } from "lucide-react"

import { EmptyState, StatusBadge } from "@/components/kino/common"
import { InlineAlert } from "@/components/inline-alert"
import { Button } from "@/components/ui/button"
import { useCRPC } from "@/lib/convex/crpc"
import { crpcServer } from "@/lib/convex/crpc-server"
import { cn } from "@/lib/utils"
import { titleMeta } from "@/lib/seo"

export const Route = createFileRoute(
  "/@{$org}/$project/settings/deleted-feedback/"
)({
  head: () => ({
    meta: [titleMeta(["Deleted Feedback"])],
  }),
  loader: async ({ context, params }) => {
    const details = await context.queryClient.ensureQueryData(
      crpcServer.project.getDetails.queryOptions({
        orgSlug: params.org,
        slug: params.project,
      })
    )
    const typed = details as {
      project?: { id?: string }
      permissions?: { canEdit?: boolean }
    } | null
    const projectId = typed?.project?.id
    if (projectId && typed?.permissions?.canEdit && context.loaderToken) {
      await context.queryClient.ensureQueryData(
        crpcServer.feedback.listPendingDeletion.queryOptions({
          cursor: null,
          limit: 50,
          projectId,
        })
      )
    }
  },
  component: DeletedFeedbackRoute,
})

function formatDeletionTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp))
}

function formatTimeRemaining(timestamp: number) {
  const remainingMs = Math.max(0, timestamp - Date.now())
  const totalMinutes = Math.ceil(remainingMs / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    return remainingHours > 0
      ? `${days}d ${remainingHours}h left`
      : `${days}d left`
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m left` : `${hours}h left`
  }

  return `${Math.max(1, minutes)}m left`
}

function deletionUrgency(timestamp: number) {
  const remainingMs = timestamp - Date.now()
  if (remainingMs <= 1000 * 60 * 60 * 6) return "urgent"
  if (remainingMs <= 1000 * 60 * 60 * 24) return "soon"
  return "normal"
}

function DeletedFeedbackRoute() {
  const params = Route.useParams()
  const crpc = useCRPC()
  const [restoreError, setRestoreError] = useState("")
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const projectQuery = useQuery(
    crpc.project.getDetails.queryOptions({
      orgSlug: params.org,
      slug: params.project,
    })
  )
  const pendingQuery = useQuery(
    crpc.feedback.listPendingDeletion.queryOptions(
      {
        cursor: null,
        limit: 50,
        projectId: projectQuery.data?.project?.id ?? "",
      },
      {
        enabled:
          !!projectQuery.data?.project?.id &&
          !!projectQuery.data.permissions.canEdit,
        skipUnauth: true,
      }
    )
  )
  const restoreMutation = useMutation(
    crpc.feedback.unmarkForDeletion.mutationOptions({
      onError: (error) => {
        setRestoreError(error.message)
        setRestoringId(null)
      },
      onSuccess: () => {
        setRestoreError("")
        setRestoringId(null)
      },
    })
  )

  if (!projectQuery.data?.project && projectQuery.isLoading) {
    return <div className="h-64 animate-pulse rounded-xl border bg-muted/30" />
  }

  if (!projectQuery.data?.project || !projectQuery.data.permissions.canEdit) {
    return (
      <EmptyState
        title="Deleted feedback unavailable"
        description="Only project editors can restore feedback marked for deletion."
      />
    )
  }

  const pendingFeedback = pendingQuery.data?.page ?? []

  return (
    <section className="space-y-5">
      <header className="border-b pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/35 text-muted-foreground">
              <Trash2 className="size-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight">
                Deleted feedback
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Restore feedback before its 48-hour permanent deletion window
                ends.
              </p>
            </div>
          </div>
          <div className="inline-flex h-8 w-fit items-center rounded-md border bg-muted/25 px-2.5 text-xs font-medium text-muted-foreground">
            {pendingFeedback.length} pending
          </div>
        </div>
      </header>

      {restoreError ? (
        <InlineAlert className="flex items-center gap-2" variant="danger">
          <AlertTriangle className="size-4 shrink-0" />
          {restoreError}
        </InlineAlert>
      ) : null}

      {pendingQuery.isLoading ? (
        <div className="overflow-hidden rounded-lg border">
          {[0, 1, 2].map((item) => (
            <div
              className="flex animate-pulse items-center justify-between gap-4 border-b p-4 last:border-b-0"
              key={item}
            >
              <div className="min-w-0 flex-1 space-y-3">
                <div className="h-4 w-2/3 rounded bg-muted" />
                <div className="flex gap-2">
                  <div className="h-5 w-20 rounded bg-muted/70" />
                  <div className="h-5 w-32 rounded bg-muted/70" />
                </div>
              </div>
              <div className="h-8 w-24 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : pendingFeedback.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 p-10 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-lg border bg-background shadow-sm">
            <Trash2 className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm font-medium">No pending deletions</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Deleted feedback will appear here until it is permanently removed.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card/30">
          {pendingFeedback.map((feedback: any) => (
            <article
              className="group relative border-b p-4 transition-colors last:border-b-0 hover:bg-muted/20"
              key={feedback.id}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="min-w-0 space-y-1.5">
                    <h3 className="truncate text-sm leading-6 font-semibold">
                      {feedback.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge kind="feedback" value={feedback.status} />
                      <span className="inline-flex h-6 max-w-full items-center rounded-md border bg-background/60 px-2 text-xs font-medium text-muted-foreground">
                        <span className="truncate">
                          {feedback.board?.name ?? "Unknown board"}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span
                      className={cn(
                        "inline-flex h-6 items-center gap-1.5 rounded-md border px-2 font-medium",
                        deletionUrgency(feedback.deletedTime) === "urgent"
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : deletionUrgency(feedback.deletedTime) === "soon"
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-muted/30 text-muted-foreground"
                      )}
                      suppressHydrationWarning
                      title={`Permanently deletes ${formatDeletionTime(
                        feedback.deletedTime
                      )}`}
                    >
                      <Clock3 className="size-3" />
                      {formatTimeRemaining(feedback.deletedTime)}
                    </span>
                    <span suppressHydrationWarning>
                      Permanently deletes{" "}
                      {formatDeletionTime(feedback.deletedTime)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:self-center">
                  <Button
                    className="w-full sm:w-auto"
                    disabled={restoreMutation.isPending}
                    onClick={() => {
                      setRestoreError("")
                      setRestoringId(feedback.id)
                      restoreMutation.mutate({ id: feedback.id })
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <RotateCcw className="size-4" />
                    {restoringId === feedback.id ? "Restoring" : "Restore"}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
