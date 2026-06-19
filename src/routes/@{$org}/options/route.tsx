import { Outlet, createFileRoute } from "@tanstack/react-router"
import { titleFromSlug, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/options")({
  head: ({ params }) => ({
    meta: [titleMeta(["Options", titleFromSlug(params.org)])],
  }),
  component: OrganizationOptionsRedirectShell,
})

function OrganizationOptionsRedirectShell() {
  return <Outlet />
}
