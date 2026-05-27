import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Link,
  Navigate,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router"

import { useCRPC } from "@/lib/convex/crpc"
import { crpcServer } from "@/lib/convex/crpc-server"

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    if (!context.loaderToken) {
      return
    }

    await Promise.all([
      context.queryClient.ensureQueryData(
        crpcServer.profile.findMyProfile.queryOptions({})
      ),
      context.queryClient.ensureQueryData(
        crpcServer.org.findMyOrgs.queryOptions({})
      ),
    ])
  },
  component: IndexPage,
})

function IndexPage() {
  const { loaderToken } = Route.useRouteContext()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  if (!loaderToken) {
    return <Navigate search={{ redirect: pathname }} to="/auth" />
  }

  return <AuthenticatedIndexPage />
}

function AuthenticatedIndexPage() {
  const crpc = useCRPC()
  const { data: user } = useSuspenseQuery(
    crpc.profile.findMyProfile.queryOptions({})
  )
  const { data: orgsData } = useSuspenseQuery(
    crpc.org.findMyOrgs.queryOptions({})
  )
  const orgs = orgsData?.teams

  return (
    <div>
      <h1>Hello, {user?.name}</h1>
      <div>Below are a list of teams you are a part of.</div>
      {!orgs?.length ? (
        <div>No orgs found.</div>
      ) : (
        orgs.map((org) => {
          return (
            <Link key={org.id} params={{ org: org.slug }} to="/@{$org}">
              {org.name}
            </Link>
          )
        })
      )}
    </div>
  )
}
