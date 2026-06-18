import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { CheckCircle2, GitBranch, RefreshCw } from "lucide-react"

import { InlineAlert } from "@/components/inline-alert"
import { EmptyState } from "@/components/kino/common"
import { Button } from "@/components/ui/button"
import { useCRPC } from "@/lib/convex/crpc"
import { crpcServer } from "@/lib/convex/crpc-server"

export const Route = createFileRoute("/@{$org}/settings/integrations/")({
  loader: async ({ context, params }) => {
    if (!context.loaderToken) return
    await context.queryClient.ensureQueryData(
      crpcServer.github.getOrgIntegration.queryOptions({ orgSlug: params.org })
    )
  },
  component: IntegrationsSettingsRoute,
})

function IntegrationsSettingsRoute() {
  const params = Route.useParams()
  const search = Route.useSearch() as { github?: string }
  const crpc = useCRPC()

  const integrationQuery = useQuery(
    crpc.github.getOrgIntegration.queryOptions({
      orgSlug: params.org,
    })
  )
  const startConnection = useMutation(
    crpc.github.startOrgConnection.mutationOptions({
      onSuccess: (result) => {
        window.location.href = result.installUrl
      },
    })
  )
  const refreshInstallations = useMutation(
    crpc.github.startOrgInstallationRefresh.mutationOptions({
      onSuccess: (result) => {
        window.location.href = result.authorizeUrl
      },
    })
  )

  const installations = integrationQuery.data?.installations ?? []
  const hasInstallations = installations.length > 0

  if (integrationQuery.isLoading) {
    return <div className="h-64 animate-pulse rounded-xl border bg-muted/30" />
  }

  if (integrationQuery.error) {
    return (
      <EmptyState
        title="GitHub integration unavailable"
        description={integrationQuery.error.message}
      />
    )
  }

  return (
    <div className="space-y-8">
      <header className="border-b pb-4">
        <h2 className="text-xl font-semibold">Integrations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect external services that power your projects. Install the Kino
          GitHub App on a GitHub organization or user account once, then any
          project here can pick a repository from those accounts.
        </p>
      </header>

      {search.github === "connected" ? (
        <InlineAlert variant="success">
          GitHub access connected. Project admins can now select a repository
          from this organization.
        </InlineAlert>
      ) : null}
      {search.github === "error" ? (
        <InlineAlert variant="danger">
          GitHub installation could not be completed.
        </InlineAlert>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-start gap-4 p-6">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-muted/40">
                <GitBranch className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold">GitHub</h3>
                  {hasInstallations ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                      <CheckCircle2 className="size-3" />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      Not connected
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sync issues and discussions between GitHub repositories and
                  Kino feedback boards.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t bg-muted/30 px-6 py-4">
              <Button
                disabled={startConnection.isPending}
                onClick={() =>
                  startConnection.mutate({
                    callbackTargetUrl: `${window.location.origin}/api/github/callback`,
                    orgSlug: params.org,
                  })
                }
                type="button"
              >
                <GitBranch className="size-4" />
                {hasInstallations
                  ? "Manage GitHub access"
                  : "Install GitHub App"}
              </Button>
              {hasInstallations ? (
                <Button
                  disabled={refreshInstallations.isPending}
                  onClick={() =>
                    refreshInstallations.mutate({
                      callbackTargetUrl: `${window.location.origin}/api/github/callback`,
                      orgSlug: params.org,
                    })
                  }
                  type="button"
                  variant="outline"
                >
                  <RefreshCw className="size-4" />
                  Refresh accounts
                </Button>
              ) : null}
            </div>
          </section>

          {startConnection.error ? (
            <InlineAlert variant="danger">
              {startConnection.error.message}
            </InlineAlert>
          ) : null}
          {refreshInstallations.error ? (
            <InlineAlert variant="danger">
              {refreshInstallations.error.message}
            </InlineAlert>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Connected accounts</h3>
              {hasInstallations ? (
                <span className="text-xs text-muted-foreground">
                  {installations.length}{" "}
                  {installations.length === 1 ? "account" : "accounts"}
                </span>
              ) : null}
            </div>

            {!hasInstallations ? (
              <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-background shadow-sm">
                  <GitBranch className="size-5 text-muted-foreground" />
                </div>
                <p className="mt-3 text-sm font-medium">
                  No GitHub accounts connected
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Install the Kino GitHub App above to get started.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {installations.map((installation) => (
                  <div
                    className="rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20"
                    key={installation.id}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg border bg-background text-sm font-bold">
                        {installation.accountLogin[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {installation.accountLogin}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {installation.accountType}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {installation.repositorySelection === "all"
                        ? "All repositories"
                        : "Selected repositories"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border bg-card p-5">
            <h3 className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              Project setup
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Open a project&apos;s integrations page to select one repository
              from these connected accounts.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
