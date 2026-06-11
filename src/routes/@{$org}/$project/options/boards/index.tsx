import { Navigate, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/@{$org}/$project/options/boards/")({
  component: ProjectOptionsBoardsRedirectRoute,
})

function ProjectOptionsBoardsRedirectRoute() {
  const params = Route.useParams()
  return <Navigate params={params} to="/@{$org}/$project/settings/boards" />
}
