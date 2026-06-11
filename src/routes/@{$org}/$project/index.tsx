import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/@{$org}/$project/")({
  component: ProjectIndexRoute,
})

function ProjectIndexRoute() {
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold md:text-3xl">Overview</h1>
    </div>
  )
}
