import { Navigate, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/@{$org}/settings/")({
  component: OrganizationSettingsIndexRoute,
})

function OrganizationSettingsIndexRoute() {
  const params = Route.useParams()
  return <Navigate params={params} to="/@{$org}/settings/general" />
}
