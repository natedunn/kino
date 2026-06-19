import { Navigate, createFileRoute } from "@tanstack/react-router"
import { projectTitle, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/$project/options/integrations/")(
  {
    head: ({ params }) => ({
      meta: [titleMeta(["Integration Options", projectTitle(params.org, params.project)])],
    }),
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
