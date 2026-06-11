import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router"
import { ArrowLeft, GitBranch, LayoutDashboard } from "lucide-react"

import { cn } from "@/lib/utils"

export const Route = createFileRoute("/@{$org}/$project/options")({
  component: ProjectOptionsRoute,
})

function ProjectOptionsRoute() {
  const params = Route.useParams()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const items = [
    {
      icon: LayoutDashboard,
      label: "Boards",
      to: "/@{$org}/$project/options/boards" as const,
    },
    {
      icon: GitBranch,
      label: "Integrations",
      to: "/@{$org}/$project/options/integrations" as const,
    },
  ]

  return (
    <div>
      <div className="border-b bg-muted/50">
        <div className="container pt-12 pb-6">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">Options</h1>
            <p className="mt-1 text-muted-foreground">
              Manage project boards and connected services.
            </p>
          </div>
        </div>
      </div>

      <div className="container py-6">
        <Link
          className="link-text inline-flex items-center gap-2 text-sm opacity-75 hocus:opacity-100"
          params={{ org: params.org, project: params.project }}
          to="/@{$org}/$project/feedback"
        >
          <ArrowLeft className="size-3" />
          Back to project
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="flex gap-2 overflow-x-auto border-b pb-3 lg:flex-col lg:overflow-visible lg:border-r lg:border-b-0 lg:pt-1 lg:pr-4 lg:pb-0">
            {items.map((item) => {
              const Icon = item.icon
              const routePath = item.to
                .replace("/@{$org}", `/@${params.org}`)
                .replace("$project", params.project)
              const isActive = pathname.startsWith(routePath)

              return (
                <Link
                  className={cn(
                    "inline-flex min-h-9 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hocus:bg-muted hocus:text-foreground",
                    isActive && "bg-muted text-foreground"
                  )}
                  key={item.to}
                  params={{ org: params.org, project: params.project }}
                  to={item.to}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
