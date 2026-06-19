import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { GitBranch, ShieldCheck, Unplug } from "lucide-react"

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
import { crpcServer } from "@/lib/convex/crpc-server"
import { titleMeta } from "@/lib/seo"

type ConnectionMode = "read" | "read_write"
type Source = "issues" | "discussions"

const connectionModeLabels: Record<ConnectionMode, string> = {
  read: "Read only",
  read_write: "Read and write",
}

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
  head: () => ({
    meta: [titleMeta(["Integrations"])],
  }),
  loader: async ({ context, params }) => {
    if (!context.loaderToken) return
    await context.queryClient.ensureQueryData(
      crpcServer.github.getProjectIntegration.queryOptions({
        orgSlug: params.org,
        projectSlug: params.project,
      })
    )
  },
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
        connectRepository.reset()
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
  const activeInstallationId = selectedInstallation?.installationId ?? null
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
  const activeConnection = connections[0] ?? null

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

      return null
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

  function handleInstallationChange(value: string | null) {
    if (value === null || value === "") return

    const nextInstallationId = Number(value)
    if (!Number.isFinite(nextInstallationId)) return
    if (nextInstallationId === activeInstallationId) return

    setSelectedInstallationId(nextInstallationId)
    setRepositoriesInstallationId(null)
    setSelectedRepoId(null)
  }

  function handleRepositoryChange(value: string | null) {
    if (value === null || value === "") return

    const nextRepoId = Number(value)
    if (!Number.isFinite(nextRepoId)) return

    setSelectedRepoId(nextRepoId)
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
                  onValueChange={handleInstallationChange}
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
                    to="/@{$org}/settings/integrations"
                  >
                    <GitBranch className="size-4" />
                    Manage GitHub access
                  </Link>
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <LabelWrapper>
                <Label>Repository</Label>
                <LabelDescription>
                  Choose the single repository this Kino project should sync
                  with.
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
                  onValueChange={handleRepositoryChange}
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
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue>
                    {(value: ConnectionMode | null) =>
                      value ? connectionModeLabels[value] : "Select mode"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Read only</SelectItem>
                  <SelectItem value="read_write">Read and write</SelectItem>
                </SelectContent>
              </Select>
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
              Verify and Save
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
            Repository settings saved.
          </InlineAlert>
        ) : null}

        {activeConnection ? (
          <section className="overflow-hidden rounded-xl border border-destructive/30 bg-card">
            <div className="p-6">
              <h3 className="text-sm font-semibold text-destructive">
                Danger zone
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Disconnecting removes the GitHub sync for this project. You can
                reconnect at any time.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
              <p className="text-xs text-muted-foreground">
                This will stop syncing issues and discussions from GitHub.
              </p>
              <Button
                disabled={disconnectRepository.isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Disconnect this repository? This will stop syncing issues and discussions from GitHub."
                    )
                  ) {
                    return
                  }
                  disconnectRepository.mutate({
                    connectionId: activeConnection.id,
                    orgSlug: params.org,
                    projectSlug: params.project,
                  })
                }}
                type="button"
                variant="destructive"
              >
                <Unplug className="size-4" />
                {disconnectRepository.isPending
                  ? "Disconnecting..."
                  : "Disconnect repository"}
              </Button>
            </div>
            {disconnectRepository.error ? (
              <div className="border-t px-6 py-4">
                <InlineAlert variant="danger">
                  {disconnectRepository.error.message}
                </InlineAlert>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}
