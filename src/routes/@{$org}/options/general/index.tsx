import { Navigate, createFileRoute } from "@tanstack/react-router"
import { titleFromSlug, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/options/general/")({
  head: ({ params }) => ({
    meta: [titleMeta(["General Options", titleFromSlug(params.org)])],
  }),
  component: OrganizationOptionsGeneralRedirectRoute,
})

function OrganizationOptionsGeneralRedirectRoute() {
  const params = Route.useParams()
  return <Navigate params={params} to="/@{$org}/settings/general" />
}
