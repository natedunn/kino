import { Link, createFileRoute } from "@tanstack/react-router"
import { projectTitle, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/$project/")({
  head: ({ params }) => ({
    meta: [titleMeta([projectTitle(params.org, params.project)])],
  }),
  component: ProjectIndexRoute,
})

function ProjectIndexRoute() {
  const params = Route.useParams()

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold md:text-3xl">Overview</h1>
      <Link
        className="link-text mt-4 inline-flex text-sm"
        params={params}
        to="/@{$org}/$project/settings"
      >
        Project settings
      </Link>
    </div>
  )
}
