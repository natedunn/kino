import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Outlet,
  createFileRoute,
  notFound,
  useParams,
} from "@tanstack/react-router"

import { DefaultCatchBoundary } from "@/components/_default-catch-boundary"
import { NotFound } from "@/components/_not-found"
import { RoutePending } from "@/components/route-pending"
import { useCRPC } from "@/lib/convex/crpc"
import { crpcServer } from "@/lib/convex/crpc-server"
import { cn } from "@/lib/utils"

import { MainNav } from "@/components/site-nav/main-nav"
import { DynamicNavigation } from "./$project/-components/dynamic-nav"
import { titleFromSlug, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}")({
  head: ({ params }) => ({
    meta: [titleMeta([titleFromSlug(params.org)])],
  }),
  loader: async ({ context, params }) => {
    const [, orgDetails] = await Promise.all([
      context.queryClient.ensureQueryData(
        crpcServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
      ),
      context.queryClient.ensureQueryData(
        crpcServer.org.getDetails.queryOptions({ slug: params.org })
      ),
    ])

    if (!orgDetails?.org) {
      throw notFound()
    }
  },
  component: OrganizationShell,
  notFoundComponent: () => <NotFound isContainer />,
  pendingComponent: () => <RoutePending variant="page" />,
  errorComponent: DefaultCatchBoundary,
})

function OrganizationShell() {
  const crpc = useCRPC()
  const params = Route.useParams()
  const { loaderToken } = Route.useRouteContext()
  const projectParams = useParams({
    from: "/@{$org}/$project",
    shouldThrow: false,
  })
  const [isProjectNavCalculating, setIsProjectNavCalculating] = useState(false)
  const profileQuery = useSuspenseQuery(
    crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
  )
  const orgQuery = useSuspenseQuery(
    crpc.org.getDetails.queryOptions({ slug: params.org })
  )

  if (!orgQuery.data?.org) {
    throw notFound()
  }

  const isUserPending = !!loaderToken && profileQuery.data === undefined
  const projectSlug = projectParams?.project
  const hasProjectNav = !!projectSlug
  const org =
    orgQuery.data?.org ??
    ({
      logo: null,
      name: params.org,
      slug: params.org,
    } as const)
  const navContext = projectSlug
    ? ({
        org,
        projectSlug,
        type: "project",
      } as const)
    : ({
        org,
        type: "org",
      } as const)

  return (
    <div className="flex min-h-screen w-full flex-col">
      <div className="flex w-full flex-1 flex-col">
        <MainNav
          context={navContext}
          isUserPending={isUserPending}
          subNav={
            projectSlug ? (
              <DynamicNavigation
                orgSlug={params.org}
                projectSlug={projectSlug}
                onStateChange={(state) =>
                  setIsProjectNavCalculating(state.isCalculating)
                }
              />
            ) : undefined
          }
          user={profileQuery.data}
        />
        <div
          className={cn(
            "flex flex-1 flex-col",
            hasProjectNav && isProjectNavCalculating && "overflow-x-hidden"
          )}
        >
          <Outlet />
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
