import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router"
import { GitBranch, Settings, Users } from "lucide-react"

import {
  SidebarNavGroup,
  SidebarNavItem,
  SidebarNavSelect,
} from "@/components/sidebar-nav"
import { titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/settings")({
  head: () => ({
    meta: [titleMeta(["Settings"])],
  }),
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
      icon: Users,
      label: "Members",
      to: "/@{$org}/settings/members" as const,
    },
    {
      icon: GitBranch,
      label: "Integrations",
      to: "/@{$org}/settings/integrations" as const,
    },
  ]
  const navItems = items.map((item) => {
    const Icon = item.icon
    const path = item.to.replace("/@{$org}", `/@${params.org}`)
    const active = pathname === path || pathname.startsWith(`${path}/`)

    return {
      active,
      icon: <Icon className="size-4" />,
      key: item.to,
      label: item.label,
      renderLink: (children: React.ReactNode) => (
        <Link params={{ org: params.org }} to={item.to}>
          {children}
        </Link>
      ),
    }
  })

  return (
    <div className="container flex flex-1 flex-col overflow-visible">
      <div className="py-4 md:hidden">
        <SidebarNavSelect items={navItems} />
      </div>
      <div className="flex flex-1 flex-col gap-8 md:grid md:grid-cols-12">
        <div className="hidden py-8 md:col-span-3 md:block md:border-r md:border-border/75">
          <div className="sticky top-6 flex flex-col overflow-hidden">
            <SidebarNavGroup className="border-b pb-6 md:pr-6" title="Settings">
              {items.map((item) => {
                const Icon = item.icon

                return (
                  <Link key={item.to} params={{ org: params.org }} to={item.to}>
                    {({ isActive }) => (
                      <SidebarNavItem
                        active={isActive}
                        icon={<Icon className="size-4" />}
                      >
                        {item.label}
                      </SidebarNavItem>
                    )}
                  </Link>
                )
              })}
            </SidebarNavGroup>
          </div>
        </div>
        <div className="flex flex-col gap-4 py-8 md:col-span-9">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
