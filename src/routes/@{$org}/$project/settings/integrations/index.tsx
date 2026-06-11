import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  CheckCircle2,
  GitBranch,
  ShieldCheck,
  Unplug,
  Webhook,
} from "lucide-react"

import { InlineAlert } from "@/components/inline-alert"
import { EmptyState } from "@/components/kino/common"
import { Label, LabelDescription, LabelWrapper } from "@/components/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCRPC } from "@/lib/convex/crpc"

type ConnectionMode = "read" | "read_write"
type Source = "issues" | "discussions"

type RepositoryOption = {
  fullName: string
  id: number
  name: string
  owner: string
  private: boolean
}

export const Route = createFileRoute(
  "/@{$org}/$project/settings/integrations/"
)({
  component: GitHubIntegrationRoute,
})

function GitHubIntegrationRoute() {
  const params = Route.useParams()
  const search = Route.useSearch() as { github?: string }
  const crpc = useCRPC()
  const [mode, setMode] = useState<ConnectionMode>("read")
  const [selectedInstallationId, setSelectedInstallationId] = useState<
    number | null
  >(null)
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null)
  const [repositoriesInstallationId, setRepositoriesInstallationId] = useState<
    number | null
  >(null)
  const [sources, setSources] = useState<Source[]>(["issues"])

  const integrationQuery = useQuery(
    crpc.github.getProjectIntegration.queryOptions({
      orgSlug: params.org,
      projectSlug: params.project,
    })
  )
  const repositoriesQuery = useMutation(
    crpc.githubExternal.listInstallationRepositoriesForProject.mutationOptions()
  )
  const connectRepository = useMutation(
    crpc.githubExternal.connectRepository.mutationOptions({
      onSuccess: () => {
        void integrationQuery.refetch()
      },
    })
  )
  const disconnectRepository = useMutation(
    crpc.github.disconnectRepository.mutationOptions({
      onSuccess: () => {
        setSelectedRepoId(null)
        void integrationQuery.refetch()
      },
    })
  )

  const installations = integrationQuery.data?.installations ?? []
  const connections = integrationQuery.data?.connections ?? []
  const connectedInstallation = connections[0]
    ? installations.find(
        (item) => item.id === connections[0].githubInstallationId
      )
    : null
  const selectedInstallation =
    installations.find(
      (installation) => installation.installationId === selectedInstallationId
    ) ??
    connectedInstallation ??
    installations[0]
  const activeInstallationId =
    selectedInstallationId ?? selectedInstallation?.installationId ?? null
  const repositories =
    repositoriesInstallationId === activeInstallationId
      ? (repositoriesQuery.data ?? [])
      : []
  const selectedRepository = useMemo(
    () => repositories.find((repository) => repository.id === selectedRepoId),
    [repositories, selectedRepoId]
  )
  const selectedRepositoryValue = selectedRepository
    ? String(selectedRepository.id)
    : ""
  const hasInstallations = installations.length > 0

  useEffect(() => {
    if (selectedInstallationId !== null) return

    const connection = connections[0]
    if (!connection) return

    const installation = installations.find(
      (item) => item.id === connection.githubInstallationId
    )
    if (!installation) return

    setSelectedInstallationId(installation.installationId)
    setSelectedRepoId(connection.repoId)
    setMode(connection.mode as ConnectionMode)
    setSources(
      connection.enabledSources.length > 0
        ? (connection.enabledSources as Source[])
        : ["issues"]
    )
  }, [connections, installations, selectedInstallationId])

  useEffect(() => {
    if (!activeInstallationId) {
      repositoriesQuery.reset()
      setRepositoriesInstallationId(null)
      setSelectedRepoId(null)
      return
    }

    repositoriesQuery.reset()
    setRepositoriesInstallationId(activeInstallationId)
    repositoriesQuery.mutate({
      installationId: activeInstallationId,
      orgSlug: params.org,
    })
  }, [activeInstallationId, params.org])

  useEffect(() => {
    if (
      !repositoriesQuery.data ||
      repositoriesInstallationId !== activeInstallationId
    ) {
      return
    }

    setSelectedRepoId((currentRepoId) => {
      if (
        currentRepoId &&
        repositoriesQuery.data.some(
          (repository) => repository.id === currentRepoId
        )
      ) {
        return currentRepoId
      }

      const connectedRepoId = connections.find((connection) => {
        const installation = installations.find(
          (item) => item.id === connection.githubInstallationId
        )
        return installation?.installationId === activeInstallationId
      })?.repoId

      if (
        connectedRepoId &&
        repositoriesQuery.data.some(
          (repository) => repository.id === connectedRepoId
        )
      ) {
        return connectedRepoId
      }

      return repositoriesQuery.data[0]?.id ?? null
    })
  }, [
    activeInstallationId,
    connections,
    installations,
    repositoriesInstallationId,
    repositoriesQuery.data,
  ])

  function toggleSource(source: Source) {
    setSources((current) => {
      if (current.includes(source)) {
        return current.length === 1
          ? current
          : current.filter((item) => item !== source)
      }
      return [...current, source]
    })
  }

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
          Choose which repository this project syncs with. GitHub accounts are
          managed at the organization level.
        </p>
      </header>

      {search.github === "connected" ? (
        <InlineAlert variant="success">
          GitHub access connected. Select the repository this project should
          sync with.
        </InlineAlert>
      ) : null}
      {search.github === "error" ? (
        <InlineAlert variant="danger">
          GitHub installation could not be completed.
        </InlineAlert>
      ) : null}
      {!hasInstallations ? (
        <InlineAlert variant="warning">
          Connect GitHub access for this organization before selecting a project
          repository.
        </InlineAlert>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-start gap-4 border-b p-6">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-muted/40">
                <GitBranch className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold">
                  Connect a GitHub repository
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick one repository from a connected GitHub account and verify
                  API access before enabling sync.
                </p>
              </div>
            </div>

            <div className="space-y-6 p-6">
              <div className="flex flex-col gap-2">
                <LabelWrapper>
                  <Label>GitHub account</Label>
                  <LabelDescription>
                    Accounts are connected in organization settings.
                  </LabelDescription>
                </LabelWrapper>
                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    items={installations.map((installation) => ({
                      label: installation.accountLogin,
                      value: String(installation.installationId),
                    }))}
                    onValueChange={(value) => {
                      setSelectedInstallationId(Number(value))
                      setRepositoriesInstallationId(null)
                      setSelectedRepoId(null)
                    }}
                    value={
                      activeInstallationId ? String(activeInstallationId) : ""
                    }
                  >
                    <SelectTrigger className="min-w-60">
                      <SelectValue placeholder="No GitHub account connected" />
                    </SelectTrigger>
                    <SelectContent>
                      {installations.map((installation) => (
                        <SelectItem
                          key={installation.id}
                          value={String(installation.installationId)}
                        >
                          {installation.accountLogin}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button asChild type="button" variant="outline">
                    <Link
                      params={{ org: params.org }}
                      to="/@{$org}/options/integrations"
                    >
                      <GitBranch className="size-4" />
                      Manage GitHub access
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <LabelWrapper>
                    <Label>Sync mode</Label>
                    <LabelDescription>
                      Read mode imports from GitHub only.
                    </LabelDescription>
                  </LabelWrapper>
                  <Select
                    onValueChange={(value) => setMode(value as ConnectionMode)}
                    value={mode}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read">Read only</SelectItem>
                      <SelectItem value="read_write">Read and write</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <LabelWrapper>
                    <Label>Sources</Label>
                    <LabelDescription>
                      Issues are always available; Discussions require GitHub
                      repository support.
                    </LabelDescription>
                  </LabelWrapper>
                  <div className="flex gap-4 pt-2">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={sources.includes("issues")}
                        onCheckedChange={() => toggleSource("issues")}
                      />
                      Issues
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={sources.includes("discussions")}
                        onCheckedChange={() => toggleSource("discussions")}
                      />
                      Discussions
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <LabelWrapper>
                  <Label>Repository</Label>
                  <LabelDescription>
                    Repositories available to the selected account load
                    automatically.
                  </LabelDescription>
                </LabelWrapper>
                <div className="space-y-2">
                  <Select
                    disabled={
                      !activeInstallationId || repositoriesQuery.isPending
                    }
                    items={repositories.map((repository: RepositoryOption) => ({
                      label: repository.fullName,
                      value: String(repository.id),
                    }))}
                    onValueChange={(value) => setSelectedRepoId(Number(value))}
                    value={selectedRepositoryValue}
                  >
                    <SelectTrigger className="min-w-72">
                      <SelectValue
                        placeholder={
                          repositoriesQuery.isPending
                            ? "Loading repositories..."
                            : "Select project repository"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {repositories.map((repository: RepositoryOption) => (
                        <SelectItem
                          key={repository.id}
                          value={String(repository.id)}
                        >
                          {repository.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {activeInstallationId && repositoriesQuery.isPending ? (
                    <p className="text-xs text-muted-foreground">
                      Loading repositories from GitHub...
                    </p>
                  ) : null}
                  {activeInstallationId &&
                  !repositoriesQuery.isPending &&
                  repositories.length === 0 &&
                  !repositoriesQuery.error ? (
                    <p className="text-xs text-muted-foreground">
                      No repositories are available for this GitHub account.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
              <p className="text-xs text-muted-foreground">
                Verification confirms the app can read this repository before
                turning sync on.
              </p>
              <Button
                disabled={
                  !activeInstallationId ||
                  !selectedRepository ||
                  connectRepository.isPending
                }
                onClick={() => {
                  if (!activeInstallationId || !selectedRepository) return
                  connectRepository.mutate({
                    enabledSources: sources,
                    installationId: activeInstallationId,
                    mode,
                    orgSlug: params.org,
                    projectSlug: params.project,
                    repoId: selectedRepository.id,
                  })
                }}
                type="button"
              >
                <ShieldCheck className="size-4" />
                Verify and connect
              </Button>
            </div>
          </section>

          {repositoriesQuery.error ? (
            <InlineAlert variant="danger">
              {repositoriesQuery.error.message}
            </InlineAlert>
          ) : null}
          {connectRepository.error ? (
            <InlineAlert variant="danger">
              {connectRepository.error.message}
            </InlineAlert>
          ) : null}
          {connectRepository.isSuccess ? (
            <InlineAlert variant="success">
              Repository connection verified.
            </InlineAlert>
          ) : null}
          {disconnectRepository.error ? (
            <InlineAlert variant="danger">
              {disconnectRepository.error.message}
            </InlineAlert>
          ) : null}
          {disconnectRepository.isSuccess ? (
            <InlineAlert variant="success">
              Repository disconnected.
            </InlineAlert>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Connected repositories</h3>
              {connections.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {connections.length}{" "}
                  {connections.length === 1 ? "repo" : "repos"}
                </span>
              ) : null}
            </div>

            {connections.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-background shadow-sm">
                  <GitBranch className="size-5 text-muted-foreground" />
                </div>
                <p className="mt-3 text-sm font-medium">
                  No repositories connected to this project
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Connect one above to start syncing issues or discussions.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {connections.map((connection) => (
                  <div
                    className="rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20"
                    key={connection.id}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
                        <GitBranch className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {connection.repoFullName}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                            <CheckCircle2 className="size-3" />
                            {connection.mode === "read_write"
                              ? "Read & write"
                              : "Read only"}
                          </span>
                          {connection.enabledSources.map((source: string) => (
                            <span
                              className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize"
                              key={source}
                            >
                              {source}
                            </span>
                          ))}
                        </div>
                        <Button
                          className="mt-3"
                          disabled={disconnectRepository.isPending}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Disconnect ${connection.repoFullName} from this project?`
                              )
                            ) {
                              return
                            }

                            disconnectRepository.mutate({
                              connectionId: connection.id,
                              orgSlug: params.org,
                              projectSlug: params.project,
                            })
                          }}
                          size="sm"
                          type="button"
                          variant="destructive"
                        >
                          <Unplug className="size-3.5" />
                          Disconnect
                        </Button>
                      </div>
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
              GitHub accounts
            </h3>
            <div className="mt-3 space-y-2">
              {installations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No GitHub accounts connected.
                </p>
              ) : (
                installations.map((installation) => (
                  <div
                    className="flex items-center gap-2 rounded-lg border px-3 py-2"
                    key={installation.id}
                  >
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background text-xs font-bold">
                      {installation.accountLogin[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {installation.accountLogin}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {installation.repositorySelection === "all"
                          ? "All repositories"
                          : "Selected repositories"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h3 className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              <Webhook className="size-3.5" />
              Webhook health
            </h3>
            <div className="mt-3 space-y-2">
              {(integrationQuery.data?.recentDeliveries ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No webhook deliveries recorded yet.
                </p>
              ) : (
                integrationQuery.data?.recentDeliveries.map((delivery) => (
                  <div
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
                    key={delivery.id}
                  >
                    <span className="font-mono text-foreground">
                      {delivery.event}
                    </span>
                    <span className="text-muted-foreground">
                      {delivery.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
