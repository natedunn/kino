import { Navigate, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/@{$org}/$project/settings/")({
  component: ProjectSettingsIndexRoute,
})

function ProjectSettingsIndexRoute() {
  const params = Route.useParams()
  return <Navigate params={params} to="/@{$org}/$project/settings/boards" />
}
