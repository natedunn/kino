import { useSuspenseQuery } from "@tanstack/react-query"
import { Outlet, createFileRoute } from "@tanstack/react-router"

import { DefaultCatchBoundary } from "@/components/_default-catch-boundary"
import { NotFound } from "@/components/_not-found"
import { RoutePending } from "@/components/route-pending"
import { useCRPC } from "@/lib/convex/crpc"
import { crpcServer } from "@/lib/convex/crpc-server"

import { MainNav } from "./-components/main-nav"
import { titleFromSlug, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}")({
  head: ({ params }) => ({
    meta: [titleMeta([titleFromSlug(params.org)])],
  }),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        crpcServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
      ),
      context.queryClient.ensureQueryData(
        crpcServer.org.getDetails.queryOptions({ slug: params.org })
      ),
    ])
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
  const profileQuery = useSuspenseQuery(
    crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
  )
  const orgQuery = useSuspenseQuery(
    crpc.org.getDetails.queryOptions({ slug: params.org })
  )
  const isUserPending = !!loaderToken && profileQuery.data === undefined

  return (
    <div className="flex min-h-screen w-full flex-col">
      <div className="flex w-full flex-1 flex-col">
        <MainNav
          isUserPending={isUserPending}
          org={orgQuery.data?.org ?? undefined}
          user={profileQuery.data}
        />
        <Outlet />
      </div>
      <footer className="mt-auto w-full border-t border-border py-4 text-center text-sm text-muted-foreground">
        <div className="container">
          <p>© {new Date().getFullYear()} Kino</p>
        </div>
      </footer>
    </div>
  )
}
