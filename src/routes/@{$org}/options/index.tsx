import { Navigate, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/@{$org}/options/")({
  component: OrganizationOptionsIndexRoute,
})

function OrganizationOptionsIndexRoute() {
  const params = Route.useParams()
  return <Navigate params={params} to="/@{$org}/options/general" />
}
