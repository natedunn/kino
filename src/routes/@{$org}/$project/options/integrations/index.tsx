import { Navigate, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/@{$org}/$project/options/integrations/")(
  {
    component: ProjectOptionsIntegrationsRedirectRoute,
  }
)

function ProjectOptionsIntegrationsRedirectRoute() {
  const params = Route.useParams()
  const search = Route.useSearch() as { github?: string }

  return (
    <Navigate
      params={params}
      search={{ github: search.github }}
      to="/@{$org}/$project/settings/integrations"
    />
  )
}
