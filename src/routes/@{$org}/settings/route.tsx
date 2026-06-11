import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router"
import { GitBranch, Settings } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/@{$org}/settings")({
  component: OrganizationSettingsRoute,
})

function OrganizationSettingsRoute() {
  const params = Route.useParams()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const items = [
    {
      icon: Settings,
      label: "General",
      to: "/@{$org}/settings/general" as const,
    },
    {
      icon: GitBranch,
      label: "Integrations",
      to: "/@{$org}/settings/integrations" as const,
    },
  ]

  return (
    <div className="container flex flex-1 flex-col overflow-visible">
      <div className="flex flex-1 flex-col gap-8 md:grid md:grid-cols-12">
        <div className="order-last py-8 md:order-first md:col-span-3 md:border-r md:border-border/75">
          <div className="sticky top-6 flex flex-col overflow-hidden">
            <div className="border-b pb-6 md:pr-6">
              <h2 className="mx-2 text-sm font-bold text-muted-foreground">
                Settings
              </h2>
              <div className="mt-2 flex flex-col gap-1">
                {items.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname.startsWith(
                    item.to.replace("/@{$org}", `/@${params.org}`)
                  )

                  return (
                    <Link
                      key={item.to}
                      params={{ org: params.org }}
                      to={item.to}
                    >
                      <span
                        className={cn(
                          isActive
                            ? buttonVariants({
                                variant: "outline",
                                className: "pointer-events-none",
                              })
                            : buttonVariants({ variant: "ghost" }),
                          "group inline-flex! w-full items-center justify-start text-left"
                        )}
                      >
                        <span className="mr-auto inline-flex items-center gap-3">
                          <Icon className="size-4" />
                          <span>{item.label}</span>
                        </span>
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4 py-8 md:col-span-9">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
