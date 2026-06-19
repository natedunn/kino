import { Navigate, createFileRoute } from "@tanstack/react-router"
import { titleFromSlug, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/options/github/")({
  head: ({ params }) => ({
    meta: [titleMeta(["GitHub Options", titleFromSlug(params.org)])],
  }),
  component: OrganizationOptionsGitHubRedirectRoute,
})

function OrganizationOptionsGitHubRedirectRoute() {
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
