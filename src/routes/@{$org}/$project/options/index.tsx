import { Navigate, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/@{$org}/$project/options/")({
  component: ProjectOptionsIndexRedirectRoute,
})

function ProjectOptionsIndexRedirectRoute() {
  const params = Route.useParams()
  return <Navigate params={params} to="/@{$org}/$project/settings" />
}
