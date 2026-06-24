import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Link,
  Navigate,
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router"
import { Bell, ChevronDown, Palette, ShieldCheck, User } from "lucide-react"

import { MainNav } from "@/components/site-nav/main-nav"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCRPC } from "@/lib/convex/crpc"
import { crpcServer } from "@/lib/convex/crpc-server"
import { cn } from "@/lib/utils"
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
  const activeItem =
    navItems.find((item) => pathname.startsWith(item.to)) ?? navItems[0]
  const ActiveIcon = activeItem.icon

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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "w-full justify-between"
                  )}
                >
                  <span className="inline-flex items-center gap-3">
                    <ActiveIcon className="size-4" />
                    {activeItem.label}
                  </span>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-[var(--anchor-width)]"
              >
                {navItems.map((item) => {
                  const Icon = item.icon

                  return (
                    <DropdownMenuItem key={item.to} asChild>
                      <Link className="flex items-center gap-3" to={item.to}>
                        <Icon className="size-4" />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-1 flex-col gap-8 md:grid md:grid-cols-12">
            {/* Desktop: persistent sidebar. */}
            <div className="hidden py-8 md:col-span-3 md:block md:border-r md:border-border/75">
              <div className="sticky top-6 flex flex-col overflow-hidden">
                <div className="border-b pb-6 md:pr-6">
                  <h2 className="mx-2 text-sm font-bold text-muted-foreground">
                    Account
                  </h2>
                  <div className="mt-2 flex flex-col gap-1">
                    {navItems.map((item) => {
                      const Icon = item.icon
                      const isActive = pathname.startsWith(item.to)

                      return (
                        <Link key={item.to} to={item.to}>
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
