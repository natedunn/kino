import { Outlet, createFileRoute } from "@tanstack/react-router"

import { NotFound } from "@/components/_not-found"

import { projectTitle, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/$project")({
  head: ({ params }) => ({
    meta: [titleMeta([projectTitle(params.org, params.project)])],
  }),
  component: ProjectRoute,
  notFoundComponent: () => (
    <div className="container">
      <NotFound />
    </div>
  ),
})

function ProjectRoute() {
  return <Outlet />
}
