import { Navigate, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/@{$org}/options/")({
  component: OrganizationOptionsIndexRedirectRoute,
})

function OrganizationOptionsIndexRedirectRoute() {
  const params = Route.useParams()
  return <Navigate params={params} to="/@{$org}/settings" />
}
