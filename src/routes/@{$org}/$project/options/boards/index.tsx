import { Navigate, createFileRoute } from "@tanstack/react-router"
import { projectTitle, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/$project/options/boards/")({
  head: ({ params }) => ({
    meta: [titleMeta(["Board Options", projectTitle(params.org, params.project)])],
  }),
  component: ProjectOptionsBoardsRedirectRoute,
})

function ProjectOptionsBoardsRedirectRoute() {
  const params = Route.useParams()
  return <Navigate params={params} to="/@{$org}/$project/settings/boards" />
}
