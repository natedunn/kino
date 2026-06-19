import { Navigate, createFileRoute } from "@tanstack/react-router"
import { titleFromSlug, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/integrations/github/")({
  head: ({ params }) => ({
    meta: [titleMeta(["GitHub Integration", titleFromSlug(params.org)])],
  }),
  component: GitHubIntegrationRedirectRoute,
})

function GitHubIntegrationRedirectRoute() {
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
