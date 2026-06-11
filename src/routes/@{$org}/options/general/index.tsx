import { Navigate, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/@{$org}/options/general/")({
  component: OrganizationOptionsGeneralRedirectRoute,
})

function OrganizationOptionsGeneralRedirectRoute() {
  const params = Route.useParams()
  return <Navigate params={params} to="/@{$org}/settings/general" />
}
