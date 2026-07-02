import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router"
import {
  GitBranch,
  LayoutDashboard,
  Settings,
  TriangleAlert,
  Users,
} from "lucide-react"

import {
  SidebarNavGroup,
  SidebarNavItem,
  SidebarNavSelect,
} from "@/components/sidebar-nav"
import { titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/$project/settings")({
  head: () => ({
    meta: [titleMeta(["Settings"])],
  }),
  component: ProjectSettingsRoute,
})

function ProjectSettingsRoute() {
  const params = Route.useParams()
  const linkParams = {
    org: params.org,
    project: params.project,
  }
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const items = [
    {
      icon: Settings,
      label: "General",
      to: "/@{$org}/$project/settings/general" as const,
    },
    {
      icon: LayoutDashboard,
      label: "Boards",
      to: "/@{$org}/$project/settings/boards" as const,
    },
    {
      icon: Users,
      label: "Members",
      to: "/@{$org}/$project/settings/members" as const,
    },
    {
      icon: GitBranch,
      label: "Integrations",
      to: "/@{$org}/$project/settings/integrations" as const,
    },
    {
      icon: TriangleAlert,
      label: "Danger",
      to: "/@{$org}/$project/settings/danger" as const,
    },
  ]
  const navItems = items.map((item) => {
    const Icon = item.icon
    const path = item.to
      .replace("/@{$org}", `/@${params.org}`)
      .replace("$project", params.project)
    const active = pathname === path || pathname.startsWith(`${path}/`)

    return {
      active,
      icon: <Icon className="size-4" />,
      key: item.to,
      label: item.label,
      renderLink: (children: React.ReactNode) => (
        <Link params={(prev) => ({ ...prev, ...linkParams })} to={item.to}>
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
                  <Link
                    key={item.to}
                    params={(prev) => ({ ...prev, ...linkParams })}
                    to={item.to}
                  >
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
