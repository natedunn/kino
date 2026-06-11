import { useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, GitBranch, RefreshCw, ShieldCheck } from "lucide-react"

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

export const Route = createFileRoute("/@{$org}/$project/integrations/github/")({
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
  const [sources, setSources] = useState<Source[]>(["issues"])

  const integrationQuery = useQuery(
    crpc.github.getProjectIntegration.queryOptions({
      orgSlug: params.org,
      projectSlug: params.project,
    })
  )
  const repositoriesQuery = useMutation(
    crpc.githubExternal.listInstallationRepositoriesForProject.mutationOptions({
      onSuccess: (repositories) => {
        setSelectedRepoId(repositories[0]?.id ?? null)
      },
    })
  )
  const connectRepository = useMutation(
    crpc.githubExternal.connectRepository.mutationOptions({
      onSuccess: () => {
        void integrationQuery.refetch()
      },
    })
  )

  const installations = integrationQuery.data?.installations ?? []
  const connections = integrationQuery.data?.connections ?? []
  const repositories = repositoriesQuery.data ?? []
  const selectedInstallation =
    installations.find(
      (installation) => installation.installationId === selectedInstallationId
    ) ?? installations[0]
  const activeInstallationId =
    selectedInstallationId ?? selectedInstallation?.installationId ?? null
  const selectedRepository = useMemo(
    () => repositories.find((repository) => repository.id === selectedRepoId),
    [repositories, selectedRepoId]
  )

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
    return null
  }

  if (integrationQuery.error) {
    return (
      <div className="container py-10">
        <EmptyState
          title="GitHub integration unavailable"
          description={integrationQuery.error.message}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="border-b bg-muted/50">
        <div className="container pt-12 pb-6">
          <div className="flex items-center gap-3">
            <GitBranch className="size-7 text-muted-foreground" />
            <div>
              <h1 className="text-2xl font-bold md:text-3xl">GitHub</h1>
              <p className="text-muted-foreground">
                Choose which repository this project syncs with. GitHub accounts
                are managed at the organization level.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        <Link
          className="link-text inline-flex items-center gap-2 text-sm opacity-75 hocus:opacity-100"
          params={{ org: params.org, project: params.project }}
          to="/@{$org}/$project/feedback"
        >
          <ArrowLeft className="size-3" />
          Back to project
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-8">
            {search.github === "connected" ? (
              <InlineAlert variant="success">
                GitHub access connected. Select the repository this project
                should sync with.
              </InlineAlert>
            ) : null}
            {search.github === "error" ? (
              <InlineAlert variant="danger">
                GitHub installation could not be completed.
              </InlineAlert>
            ) : null}
            {installations.length === 0 ? (
              <InlineAlert variant="warning">
                Connect GitHub access for this organization before selecting a
                project repository.
              </InlineAlert>
            ) : null}

            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">
                  Project repository sync
                </h2>
                <p className="text-sm text-muted-foreground">
                  Choose one repository from the connected GitHub account and
                  verify API access before enabling sync.
                </p>
              </div>

              <div className="space-y-2">
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

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
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

                <div className="space-y-2">
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

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={
                    !activeInstallationId || repositoriesQuery.isPending
                  }
                  onClick={() => {
                    if (!activeInstallationId) return
                    repositoriesQuery.mutate({
                      installationId: activeInstallationId,
                      orgSlug: params.org,
                    })
                  }}
                  type="button"
                  variant="outline"
                >
                  <RefreshCw className="size-4" />
                  Load accessible repos
                </Button>

                <Select
                  items={repositories.map((repository: RepositoryOption) => ({
                    label: repository.fullName,
                    value: String(repository.id),
                  }))}
                  onValueChange={(value) => setSelectedRepoId(Number(value))}
                  value={selectedRepoId ? String(selectedRepoId) : ""}
                >
                  <SelectTrigger className="min-w-72">
                    <SelectValue placeholder="Select project repository" />
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
            </section>
          </div>

          <aside className="space-y-6 border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <section>
              <h2 className="text-sm font-bold text-muted-foreground">
                GitHub accounts
              </h2>
              <div className="mt-3 space-y-3">
                {installations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No GitHub accounts connected.
                  </p>
                ) : (
                  installations.map((installation) => (
                    <div
                      className="rounded-lg border p-3 text-sm"
                      key={installation.id}
                    >
                      <div className="font-medium">
                        {installation.accountLogin}
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        {installation.repositorySelection === "all"
                          ? "All repositories"
                          : "Selected repositories"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-bold text-muted-foreground">
                Project repositories
              </h2>
              <div className="mt-3 space-y-3">
                {connections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No repositories connected to this project.
                  </p>
                ) : (
                  connections.map((connection) => (
                    <div
                      className="rounded-lg border p-3 text-sm"
                      key={connection.id}
                    >
                      <div className="font-medium">
                        {connection.repoFullName}
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        {connection.mode === "read_write"
                          ? "Read and write"
                          : "Read only"}{" "}
                        / {connection.enabledSources.join(", ")}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-bold text-muted-foreground">
                Webhook health
              </h2>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                {(integrationQuery.data?.recentDeliveries ?? []).length ===
                0 ? (
                  <p>No webhook deliveries recorded yet.</p>
                ) : (
                  integrationQuery.data?.recentDeliveries.map((delivery) => (
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
      </div>
    </div>
  )
}
