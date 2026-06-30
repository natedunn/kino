import React from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { Command, Ellipsis } from "lucide-react"

import { UserDropdown } from "./user-dropdown"
import { NavButton } from "./nav-button"
import type { API } from "@/lib/api"

import { useCommandPalette } from "@/components/command"
import { KinoMark } from "@/components/kino-mark"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Bell from "@/icons/bell"
import SearchSparkle from "@/icons/search-sparkle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const notifications = [
  {
    id: 1,
    title: "New issue assigned",
    description: "Bug report #123 needs attention",
    time: "2 min ago",
  },
  {
    id: 2,
    title: "PR review requested",
    description: "Feature/auth-system ready for review",
    time: "1 hour ago",
  },
  {
    id: 3,
    title: "Deployment successful",
    description: "Production deploy completed",
    time: "3 hours ago",
  },
]

type MainNavProps = {
  context: MainNavContext
  isUserPending?: boolean
  subNav?: React.ReactNode
  user: API["profile"]["findMyProfile"] | null | undefined
}

type MainNavOrg = {
  logo?: string | null
  slug: string
  name: string
}

type MainNavContext =
  | {
      type: "global"
    }
  | {
      org: MainNavOrg
      type: "org"
    }
  | {
      org: MainNavOrg
      projectSlug: string
      type: "project"
    }

export const MainNav = ({
  context,
  isUserPending = false,
  subNav,
  user,
}: MainNavProps) => {
  const commandPalette = useCommandPalette()
  const routerState = useRouterState()

  const org = context.type === "global" ? undefined : context.org
  const orgSlug = org?.slug
  const projectSlug =
    context.type === "project" ? context.projectSlug : undefined
  const orgInitial = (org?.name ?? orgSlug ?? "")[0]?.toUpperCase()
  const hasSubNav = !!subNav

  return (
    <>
      <nav className="bg-muted dark:bg-black">
        <div className={cn(!hasSubNav && "border-b")}>
          <div className="container">
            {/* Top row */}
            <div className="flex items-center justify-between py-3">
              {/* Left: Logo and org/project */}
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    aria-label="Go to dashboard"
                    className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md border border-foreground/15 transition-shadow dark:border-foreground/25 hocus:ring-2 hocus:ring-ring/50 hocus:ring-offset-2 hocus:ring-offset-background"
                    to="/dashboard"
                  >
                    <KinoMark
                      aria-hidden="true"
                      className="h-full w-full text-background dark:text-card"
                    />
                  </Link>
                  {!!orgSlug && (
                    <div
                      className={cn(
                        "-ml-3 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-foreground/15 ring-2 ring-muted select-none dark:border-foreground/25 dark:ring-black",
                        org?.logo ? "bg-background" : "bg-foreground",
                        projectSlug && "max-[459px]:hidden"
                      )}
                    >
                      {org?.logo ? (
                        <img
                          alt=""
                          className="h-full w-full object-cover"
                          src={org.logo}
                        />
                      ) : (
                        <span className="text-sm font-bold text-background">
                          {orgInitial}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-sm md:text-base">
                  {!!orgSlug && !!projectSlug ? (
                    <>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-label={`Show ${orgSlug} organization`}
                            variant="ghost"
                            size="xs"
                            className="h-6 px-1.5 text-muted-foreground min-[460px]:hidden"
                          >
                            <Ellipsis className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem asChild>
                            <Link
                              to="/@{$org}"
                              className="flex min-w-0 items-center"
                              params={{ org: orgSlug }}
                            >
                              <span className="truncate">{orgSlug}</span>
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Link
                        to="/@{$org}"
                        className="link-text hidden max-w-[7rem] truncate no-underline! outline-none focus-visible:outline-none min-[460px]:block md:max-w-[8rem] lg:max-w-[12rem] hocus:underline!"
                        params={{ org: orgSlug }}
                      >
                        {orgSlug}
                      </Link>
                      <span className="text-muted-foreground">/</span>
                      <Link
                        to="/@{$org}/$project"
                        className="link-text block max-w-[9rem] min-w-0 truncate no-underline! outline-none focus-visible:outline-none sm:max-w-[12rem] md:max-w-[18rem] lg:max-w-[24rem] hocus:underline!"
                        params={(prev) => ({
                          ...prev,
                          org: orgSlug,
                          project: projectSlug,
                        })}
                      >
                        {projectSlug}
                      </Link>
                    </>
                  ) : (
                    !!orgSlug && (
                      <Link
                        to="/@{$org}"
                        className="link-text block max-w-[10rem] truncate no-underline! outline-none focus-visible:outline-none sm:max-w-[14rem] md:max-w-[18rem] hocus:underline!"
                        params={{ org: orgSlug }}
                      >
                        {orgSlug}
                      </Link>
                    )
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <div className="hidden md:block">
                  <NavButton
                    aria-keyshortcuts="Meta+K Control+K"
                    className="max-w-xs justify-start px-3 text-muted-foreground"
                    onClick={commandPalette.open}
                  >
                    <SearchSparkle className="mr-2 size-4 shrink-0" />
                    <span className="truncate text-muted-foreground/75">
                      Search or jump to...
                    </span>
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      <kbd className="pointer-events-none inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground select-none dark:border-border dark:bg-muted dark:text-muted-foreground">
                        <Command className="size-2.5" />K
                      </kbd>
                    </div>
                  </NavButton>
                </div>

                <NavButton
                  size="icon"
                  aria-keyshortcuts="Meta+K Control+K"
                  className="text-muted-foreground md:hidden"
                  onClick={commandPalette.open}
                >
                  <SearchSparkle className="size-4" />
                  <span className="sr-only">Search</span>
                </NavButton>

                {user ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <NavButton
                        aria-label={`Open notifications (${notifications.length} unread)`}
                        size="icon"
                        className="relative"
                      >
                        <Bell className="size-4" />
                        <Badge
                          aria-hidden="true"
                          variant="destructive"
                          className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs"
                        >
                          {notifications.length}
                        </Badge>
                      </NavButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="z-20 w-80">
                      <div className="px-3 py-2 text-sm font-semibold">
                        Notifications
                      </div>
                      <DropdownMenuSeparator />
                      {notifications.map((notification) => (
                        <DropdownMenuItem
                          key={notification.id}
                          className="flex flex-col items-start p-3"
                        >
                          <div className="font-medium">
                            {notification.title}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {notification.description}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {notification.time}
                          </div>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-center text-sm text-muted-foreground">
                        View all notifications
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}

                {user ? (
                  <UserDropdown orgSlug={orgSlug} user={user} />
                ) : isUserPending ? (
                  <div className="flex h-9 w-28 animate-pulse items-center gap-2 rounded-md px-3">
                    <div className="size-6 rounded-full bg-muted" />
                    <div className="hidden h-4 w-12 rounded bg-muted sm:block" />
                  </div>
                ) : (
                  <Link
                    to="/auth"
                    search={{
                      redirect: routerState.location.pathname,
                    }}
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {hasSubNav ? <div className="border-b pt-2">{subNav}</div> : null}
      </nav>
    </>
  )
}
