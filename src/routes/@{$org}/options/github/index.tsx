import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { GitBranch, RefreshCw } from "lucide-react"

import { InlineAlert } from "@/components/inline-alert"
import { EmptyState } from "@/components/kino/common"
import { Button } from "@/components/ui/button"
import { useCRPC } from "@/lib/convex/crpc"

export const Route = createFileRoute("/@{$org}/options/github/")({
  component: GitHubOptionsRoute,
})

function GitHubOptionsRoute() {
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
  const recentDeliveries = integrationQuery.data?.recentDeliveries ?? []

  if (integrationQuery.isLoading) {
    return null
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
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-8">
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

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">GitHub</h2>
            <p className="text-sm text-muted-foreground">
              Install the Kino GitHub App on a GitHub organization or user
              account once. Each project in Kino can then connect to one of the
              repositories that app installation can access.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
              {installations.length > 0
                ? "Manage GitHub access"
                : "Install GitHub App"}
            </Button>
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
          </div>

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
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Connected accounts</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {installations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No GitHub accounts connected.
              </p>
            ) : (
              installations.map((installation) => (
                <div
                  className="rounded-lg border p-4 text-sm"
                  key={installation.id}
                >
                  <div className="font-medium">{installation.accountLogin}</div>
                  <div className="mt-1 text-muted-foreground">
                    {installation.accountType} /{" "}
                    {installation.repositorySelection === "all"
                      ? "All repositories"
                      : "Selected repositories"}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <aside className="space-y-6 border-t pt-6 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
        <section>
          <h2 className="text-sm font-bold text-muted-foreground">
            Project setup
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Open a project&apos;s GitHub integration page to select one
            repository from these connected accounts.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-bold text-muted-foreground">
            Webhook health
          </h2>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            {recentDeliveries.length === 0 ? (
              <p>No webhook deliveries recorded yet.</p>
            ) : (
              recentDeliveries.map((delivery) => (
                <div className="rounded-lg border p-2" key={delivery.id}>
                  <div className="font-medium text-foreground">
                    {delivery.event}
                  </div>
                  <div>{delivery.status}</div>
                </div>
              ))
            )}
          </div>
        </section>
      </aside>
    </div>
  )
}
