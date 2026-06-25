import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Check, Link as LinkIcon, Plus, Search } from "lucide-react"

import type { GitHubTargetData } from "../-types"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { GithubIcon } from "@/icons"
import { useCRPC } from "@/lib/convex/crpc"
import { cn } from "@/lib/utils"
import { FORM_LIMITS } from "@/lib/validation"

export function GithubConnectionIcon() {
  return <GithubIcon className="size-3.5 shrink-0 text-muted-foreground" />
}

export function GithubIssueStateBadge({ state }: { state: string }) {
  const normalizedState = state.trim().toLowerCase()
  const isOpen = normalizedState === "open"

  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium whitespace-nowrap capitalize",
        isOpen
          ? "bg-green-500/10 text-green-600 dark:text-green-400"
          : "bg-muted text-muted-foreground"
      )}
    >
      {normalizedState || "unknown"}
    </span>
  )
}

export function GitHubConnectionDialog({
  feedbackId,
  feedbackTitle,
  onOpenChange,
  open,
  orgSlug,
  projectSlug,
}: {
  feedbackId: string
  feedbackTitle: string
  onOpenChange: (open: boolean) => void
  open: boolean
  orgSlug: string
  projectSlug: string
}) {
  const crpc = useCRPC()
  const [mode, setMode] = useState<"existing" | "create">("existing")
  const [query, setQuery] = useState("")
  const [selectedTarget, setSelectedTarget] = useState<GitHubTargetData | null>(
    null
  )
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [localError, setLocalError] = useState("")

  const searchMutation = useMutation(
    crpc.feedbackGithub.searchTargets.mutationOptions()
  )
  const availabilityQuery = useQuery(
    crpc.feedbackGithub.getAvailability.queryOptions(
      { feedbackId },
      { enabled: open, skipUnauth: true }
    )
  )
  const connectExistingMutation = useMutation(
    // The connections list is a live subscription, so it updates on its own
    // once the connection is written server-side — just close the dialog.
    crpc.feedbackGithub.connectExisting.mutationOptions({
      onSuccess: () => {
        onOpenChange(false)
      },
    })
  )
  const createMutation = useMutation(
    crpc.feedbackGithub.createAndConnect.mutationOptions({
      onSuccess: () => {
        onOpenChange(false)
      },
    })
  )

  useEffect(() => {
    if (!open) {
      setMode("existing")
      setQuery("")
      setSelectedTarget(null)
      setTitle("")
      setBody("")
      setLocalError("")
      searchMutation.reset()
      connectExistingMutation.reset()
      createMutation.reset()
    }
  }, [open])

  useEffect(() => {
    if (!open || mode !== "existing") return
    if (availabilityQuery.data && !availabilityQuery.data.issuesEnabled) return

    const timeout = window.setTimeout(() => {
      searchMutation.mutate({
        feedbackId,
        kind: "issue",
        query: query.slice(0, FORM_LIMITS.feedbackSearch),
      })
      setSelectedTarget(null)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [availabilityQuery.data?.issuesEnabled, feedbackId, mode, open, query])

  const searchResults = (searchMutation.data ?? []) as GitHubTargetData[]
  const availability = availabilityQuery.data
  const sourceDisabled = !!availability && !availability.issuesEnabled
  const writeDisabled =
    !!availability && availability.connected && !availability.writable
  const repoMissing = !!availability && !availability.connected
  const error =
    localError ||
    (availabilityQuery.error?.message ??
      connectExistingMutation.error?.message ??
      createMutation.error?.message ??
      searchMutation.error?.message)
  const feedbackUrl =
    typeof window === "undefined" ? "" : window.location.href.split("#")[0]
  const canCreate =
    title.trim().length > 0 &&
    title.trim().length <= FORM_LIMITS.githubTitle &&
    body.trim().length <= FORM_LIMITS.githubBody &&
    !createMutation.isPending &&
    !sourceDisabled &&
    !writeDisabled &&
    !repoMissing
  const canConnect =
    !!selectedTarget &&
    !sourceDisabled &&
    !writeDisabled &&
    !repoMissing &&
    !connectExistingMutation.isPending &&
    !searchMutation.isPending

  function handleConnectExisting() {
    setLocalError("")
    if (!selectedTarget || !feedbackUrl) return

    connectExistingMutation.mutate({
      feedbackId,
      feedbackUrl,
      githubNumber: selectedTarget.number,
      kind: "issue",
    })
  }

  function handleCreate() {
    setLocalError("")
    if (!feedbackUrl) return
    if (title.trim().length > FORM_LIMITS.githubTitle) {
      setLocalError(
        `GitHub issue titles must be ${FORM_LIMITS.githubTitle} characters or fewer.`
      )
      return
    }
    if (body.trim().length > FORM_LIMITS.githubBody) {
      setLocalError(
        `GitHub issue bodies must be ${FORM_LIMITS.githubBody} characters or fewer.`
      )
      return
    }

    createMutation.mutate({
      body,
      feedbackId,
      feedbackUrl,
      kind: "issue",
      title: title.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
              <GithubIcon className="size-4 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-sm leading-tight font-semibold">
                Connect GitHub
              </h2>
              <p className="mt-0.5 line-clamp-1 max-w-xs text-xs text-muted-foreground">
                {feedbackTitle}
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 border-y bg-muted/30 px-5 py-2">
          {/* Mode segmented control */}
          <div className="flex items-center rounded-md bg-background p-0.5 shadow-sm ring-1 ring-border/60">
            <button
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-all",
                mode === "existing"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMode("existing")}
              type="button"
            >
              Link existing
            </button>
            <button
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-all",
                mode === "create"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMode("create")}
              type="button"
            >
              Create new
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {availabilityQuery.isLoading ? (
            <div className="space-y-2">
              <div className="h-9 animate-pulse rounded-lg bg-muted/50" />
              <div className="h-14 animate-pulse rounded-lg bg-muted/50" />
              <div className="h-14 animate-pulse rounded-lg bg-muted/50" />
            </div>
          ) : sourceDisabled ? (
            <GitHubConnectionNotice
              description="Issues are not enabled for this project's connected GitHub repository."
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              title="Enable GitHub Issues"
            />
          ) : repoMissing ? (
            <GitHubConnectionNotice
              description="Connect a GitHub repository before linking feedback to issues."
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              title="Connect a GitHub repository"
            />
          ) : writeDisabled ? (
            <GitHubConnectionNotice
              description="This GitHub repository is connected read-only. Reconnect it with read/write access before linking feedback."
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              title="Reconnect with write access"
            />
          ) : mode === "existing" ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-9 text-sm"
                  maxLength={FORM_LIMITS.feedbackSearch}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search issues..."
                  value={query}
                />
              </div>
              <div className="space-y-1">
                {searchMutation.isPending ? (
                  <div className="space-y-1.5">
                    <div className="h-14 animate-pulse rounded-lg bg-muted/50" />
                    <div className="h-14 animate-pulse rounded-lg bg-muted/50" />
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((target) => (
                    <button
                      className={cn(
                        "flex w-full min-w-0 items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-all hover:bg-muted/50",
                        selectedTarget?.nodeId === target.nodeId
                          ? "border-primary/25 bg-primary/5 ring-1 ring-primary/20"
                          : "hover:border-border/60"
                      )}
                      key={target.nodeId}
                      onClick={() => setSelectedTarget(target)}
                      type="button"
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                        <GithubConnectionIcon />
                      </div>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm leading-tight font-medium">
                          #{target.number} {target.title}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              target.state === "open"
                                ? "bg-green-500"
                                : "bg-muted-foreground/50"
                            )}
                          />
                          {target.state}
                        </span>
                      </span>
                      {selectedTarget?.nodeId === target.nodeId ? (
                        <Check className="size-3.5 shrink-0 text-primary" />
                      ) : null}
                    </button>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                    {searchMutation.data
                      ? "No issues found."
                      : "Loading issues..."}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Title
                </label>
                <Input
                  className="h-9 text-sm"
                  maxLength={FORM_LIMITS.githubTitle}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Issue title"
                  value={title}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Body{" "}
                  <span className="font-normal text-muted-foreground/60">
                    (optional)
                  </span>
                </label>
                <Textarea
                  className="min-h-28 resize-none text-sm"
                  maxLength={FORM_LIMITS.githubBody}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Add a description…"
                  value={body}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t bg-muted/20 px-5 py-3">
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => onOpenChange(false)}
              size="sm"
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            {mode === "existing" ? (
              <Button
                disabled={!canConnect}
                onClick={handleConnectExisting}
                size="sm"
                type="button"
              >
                <LinkIcon className="size-3.5" />
                Connect
              </Button>
            ) : (
              <Button
                disabled={!canCreate}
                onClick={handleCreate}
                size="sm"
                type="button"
              >
                <Plus className="size-3.5" />
                Create & connect
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function GitHubConnectionNotice({
  description,
  orgSlug,
  projectSlug,
  title,
}: {
  description: string
  orgSlug: string
  projectSlug: string
  title: string
}) {
  return (
    <div className="rounded-lg border border-dashed p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <GithubIcon className="size-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-sm leading-tight font-medium">{title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <Button asChild size="sm" type="button" variant="outline">
            <Link
              params={{ org: orgSlug, project: projectSlug }}
              to="/@{$org}/$project/settings/integrations"
            >
              <GithubIcon className="size-3.5" />
              Open GitHub settings
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
