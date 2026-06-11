import { useQuery } from "@tanstack/react-query"
import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router"
import {
  ChevronLeft,
  GitBranch,
  LayoutDashboard,
  Settings2,
} from "lucide-react"

import { useCRPC } from "@/lib/convex/crpc"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/@{$org}/$project/settings")({
  component: ProjectSettingsRoute,
})

function ProjectSettingsRoute() {
  const params = Route.useParams()
  const crpc = useCRPC()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const projectQuery = useQuery(
    crpc.project.getDetails.queryOptions({
      orgSlug: params.org,
      slug: params.project,
    })
  )
  const project = projectQuery.data?.project

  const items = [
    {
      description: "Feedback boards and views",
      icon: LayoutDashboard,
      label: "Boards",
      to: "/@{$org}/$project/settings/boards" as const,
    },
    {
      description: "GitHub and connected sources",
      icon: GitBranch,
      label: "Integrations",
      to: "/@{$org}/$project/settings/integrations" as const,
    },
  ]

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b bg-muted/50">
        <div className="container pt-10 pb-8">
          <Link
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hocus:text-foreground"
            params={{ org: params.org, project: params.project }}
            to="/@{$org}/$project"
          >
            <ChevronLeft className="size-4" />
            {project?.name ?? "Back to project"}
          </Link>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl border bg-background shadow-sm">
              <Settings2 className="size-5" />
            </div>
            <div>
              <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                Project
              </p>
              <h1 className="text-2xl leading-tight font-bold md:text-3xl">
                Settings
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="container pt-8 pb-16">
        <div className="grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav className="flex flex-col gap-1">
            <p className="mb-2 px-3 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              Manage
            </p>
            <div className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
              {items.map((item) => {
                const Icon = item.icon
                const routePath = item.to
                  .replace("/@{$org}", `/@${params.org}`)
                  .replace("$project", params.project)
                const isActive = pathname.startsWith(routePath)

                return (
                  <Link
                    className={cn(
                      "group relative inline-flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hocus:bg-muted hocus:text-foreground",
                      isActive && "bg-muted text-foreground shadow-sm"
                    )}
                    key={item.to}
                    params={{ org: params.org, project: params.project }}
                    to={item.to}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors",
                        isActive && "border-foreground/20 text-foreground"
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </nav>

          <div className="min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
