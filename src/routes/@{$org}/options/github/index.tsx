import { Navigate, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/@{$org}/options/github/")({
  component: GitHubOptionsRedirectRoute,
})

function GitHubOptionsRedirectRoute() {
  const params = Route.useParams()
  const search = Route.useSearch() as { github?: string }

  return (
    <Navigate
      params={params}
      search={{ github: search.github }}
      to="/@{$org}/options/integrations"
    />
  )
}
