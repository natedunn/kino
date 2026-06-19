import { Navigate, createFileRoute } from "@tanstack/react-router"
import { titleFromSlug, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/options/integrations/")({
  head: ({ params }) => ({
    meta: [titleMeta(["Integration Options", titleFromSlug(params.org)])],
  }),
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
