import { Navigate, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/@{$org}/options/integrations/")({
  component: OrganizationOptionsIntegrationsRedirectRoute,
})

function OrganizationOptionsIntegrationsRedirectRoute() {
  const params = Route.useParams()
  const search = Route.useSearch() as { github?: string }

  return (
    <Navigate
      params={params}
      search={{ github: search.github }}
      to="/@{$org}/settings/integrations"
    />
  )
}
