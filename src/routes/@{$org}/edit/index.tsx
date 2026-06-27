import { Navigate, createFileRoute } from "@tanstack/react-router"
import { titleFromSlug, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/edit/")({
  head: ({ params }) => ({
    meta: [titleMeta(["Edit Organization", titleFromSlug(params.org)])],
  }),
  component: EditOrganizationRedirectRoute,
})

function EditOrganizationRedirectRoute() {
  const params = Route.useParams()
  return (
    <Navigate search={{ org: params.org }} to="/org/settings/general" />
  )
}
