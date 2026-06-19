import { Navigate, createFileRoute } from "@tanstack/react-router"
import { titleFromSlug, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/options/")({
  head: ({ params }) => ({
    meta: [titleMeta(["Options", titleFromSlug(params.org)])],
  }),
  component: OrganizationOptionsIndexRedirectRoute,
})

function OrganizationOptionsIndexRedirectRoute() {
  const params = Route.useParams()
  return <Navigate params={params} to="/@{$org}/settings" />
}
