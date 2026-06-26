import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Link,
  Navigate,
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router"
import { Bell, Database, Palette, ShieldCheck, User } from "lucide-react"

import { MainNav } from "@/components/site-nav/main-nav"
import {
  SidebarNavGroup,
  SidebarNavItem,
  SidebarNavSelect,
} from "@/components/sidebar-nav"
import { useCRPC } from "@/lib/convex/crpc"
import { crpcServer } from "@/lib/convex/crpc-server"
import { titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [titleMeta(["Account"])],
  }),
  loader: async ({ context }) => {
    if (!context.loaderToken) {
      return
    }

    await context.queryClient.ensureQueryData(
      crpcServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
    )
  },
  component: AccountRoute,
})

const navItems = [
  {
    icon: User,
    label: "Profile",
    to: "/account/profile" as const,
  },
  {
    icon: Palette,
    label: "Appearance",
    to: "/account/appearance" as const,
  },
  {
    icon: Bell,
    label: "Notifications",
    to: "/account/notifications" as const,
  },
  {
    icon: Database,
    label: "Data",
    to: "/account/data" as const,
  },
  {
    icon: ShieldCheck,
    label: "Security",
    to: "/account/security" as const,
  },
]

function AccountRoute() {
  const { loaderToken } = Route.useRouteContext()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  if (!loaderToken) {
    return <Navigate search={{ redirect: pathname }} to="/auth" />
  }

  return <AuthenticatedAccountShell />
}

function AuthenticatedAccountShell() {
  const crpc = useCRPC()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  // Suspense guarantees the profile is resolved by the time we render, so the
  // nav never needs a pending state here.
  const profileQuery = useSuspenseQuery(
    crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
  )
  const selectItems = navItems.map((item) => {
    const Icon = item.icon
    const active = pathname === item.to || pathname.startsWith(`${item.to}/`)

    return {
      active,
      icon: <Icon className="size-4" />,
      key: item.to,
      label: item.label,
      renderLink: (children: React.ReactNode) => (
        <Link to={item.to}>{children}</Link>
      ),
    }
  })

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <div className="flex w-full flex-1 flex-col">
        <MainNav
          context={{ type: "global" }}
          isUserPending={false}
          user={profileQuery.data}
        />
        <div className="container flex flex-1 flex-col overflow-visible">
          {/* Mobile: section navigation collapses into a dropdown. */}
          <div className="py-4 md:hidden">
            <SidebarNavSelect items={selectItems} />
          </div>

          <div className="flex flex-1 flex-col gap-8 md:grid md:grid-cols-12">
            {/* Desktop: persistent sidebar. */}
            <div className="hidden py-8 md:col-span-3 md:block md:border-r md:border-border/75">
              <div className="sticky top-6 flex flex-col overflow-hidden">
                <SidebarNavGroup
                  className="border-b pb-6 md:pr-6"
                  title="Account"
                >
                  {navItems.map((item) => {
                    const Icon = item.icon

                    return (
                      <Link key={item.to} to={item.to}>
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
            <div className="flex flex-col gap-4 pb-8 md:col-span-9 md:py-8">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
      <footer className="mt-auto w-full border-t border-border py-4 text-center text-sm text-muted-foreground">
        <div className="container">
          <p>© {new Date().getFullYear()} Kino</p>
        </div>
      </footer>
    </div>
  )
}
