import { Navigate, createFileRoute } from "@tanstack/react-router"
import { titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/settings/")({
  head: () => ({
    meta: [titleMeta(["Settings"])],
  }),
  component: OrganizationSettingsIndexRoute,
})

function OrganizationSettingsIndexRoute() {
  const params = Route.useParams()
  return <Navigate params={params} to="/@{$org}/settings/general" />
}
