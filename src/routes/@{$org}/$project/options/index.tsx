import { Navigate, createFileRoute } from "@tanstack/react-router"
import { projectTitle, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/$project/options/")({
  head: ({ params }) => ({
    meta: [titleMeta(["Options", projectTitle(params.org, params.project)])],
  }),
  component: ProjectOptionsIndexRedirectRoute,
})

function ProjectOptionsIndexRedirectRoute() {
  const params = Route.useParams()
  return <Navigate params={params} to="/@{$org}/$project/settings" />
}
