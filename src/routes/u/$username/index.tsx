import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { Link as LinkIcon, MapPin, User2 } from "lucide-react"

import { NotFound } from "@/components/_not-found"
import { MainNav } from "@/components/site-nav/main-nav"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useCRPC } from "@/lib/convex/crpc"
import { crpcServer } from "@/lib/convex/crpc-server"
import { titleFromSlug, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/u/$username/")({
  head: ({ params }) => ({
    meta: [titleMeta([titleFromSlug(params.username)])],
  }),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        crpcServer.profile.getByUsername.queryOptions({
          username: params.username,
        })
      ),
      context.queryClient.ensureQueryData(
        crpcServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
      ),
    ])
  },
  component: PublicProfileRoute,
})

function PublicProfileRoute() {
  const { username } = Route.useParams()
  const crpc = useCRPC()
  const profileQuery = useSuspenseQuery(
    crpc.profile.getByUsername.queryOptions({ username })
  )
  const currentViewerQuery = useQuery(
    crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
  )
  const profile = profileQuery.data

  if (!profile) {
    return (
      <NotFound
        isContainer
        className="py-12"
        message="This user profile is not available."
      />
    )
  }

  const displayName = profile.name?.trim() || profile.username
  const fallbackInitial = displayName.charAt(0).toUpperCase()
  const visibleOrgCount =
    profile.ownedOrganizations.length + profile.memberOrganizations.length

  return (
    <div className="min-h-svh bg-background">
      <MainNav
        context={{ type: "global" }}
        isUserPending={currentViewerQuery.isLoading}
        user={currentViewerQuery.data}
      />

      <main className="container py-12">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border bg-card p-8 shadow-xs">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-4">
                <Avatar className="size-20 border">
                  <AvatarImage
                    alt={profile.username}
                    src={profile.imageUrl ?? undefined}
                  />
                  <AvatarFallback className="text-lg font-semibold">
                    {fallbackInitial || <User2 className="size-5" />}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h1 className="truncate text-3xl font-bold tracking-tight">
                    {displayName}
                  </h1>
                  <p className="mt-1 text-base text-muted-foreground">
                    @{profile.username}
                  </p>
                  {profile.bio ? (
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-foreground/80">
                      {profile.bio}
                    </p>
                  ) : null}
                  <p className="mt-4 text-sm text-muted-foreground">
                    {visibleOrgCount === 0
                      ? profile.isViewerProfile
                        ? "No organizations listed yet."
                        : "No public organizations listed."
                      : `${visibleOrgCount} ${profile.isViewerProfile ? "" : "public "}organization${visibleOrgCount === 1 ? "" : "s"}`}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {profile.location ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-4" />
                        {profile.location}
                      </span>
                    ) : null}
                    {profile.urls.map((item: { text: string; url: string }) => (
                      <a
                        key={`${item.text}-${item.url}`}
                        className="inline-flex items-center gap-1.5 hover:text-foreground hover:underline"
                        href={item.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <LinkIcon className="size-4" />
                        {item.text}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <OrganizationSection
              description={
                profile.isViewerProfile
                  ? "Organizations you own or administer. Private organizations are visible to you here."
                  : "Public organizations this user owns or administers."
              }
              emptyText={
                profile.isViewerProfile
                  ? "No owned organizations."
                  : "No public owned organizations."
              }
              organizations={profile.ownedOrganizations}
              title="Owned Organizations"
            />
            <OrganizationSection
              description={
                profile.isViewerProfile
                  ? "Organizations you belong to. Private organizations are visible to you here."
                  : "Public organizations this user is a member of."
              }
              emptyText={
                profile.isViewerProfile
                  ? "No member organizations."
                  : "No public member organizations."
              }
              organizations={profile.memberOrganizations}
              title="Member Organizations"
            />
          </div>
        </div>
      </main>
    </div>
  )
}

function OrganizationSection({
  description,
  emptyText,
  organizations,
  title,
}: {
  description: string
  emptyText: string
  organizations: Array<{
    id: string
    name: string
    role: string
    slug: string
    visibility: string
  }>
  title: string
}) {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-xs">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {organizations.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="mt-6 space-y-3">
          {organizations.map((organization) => (
            <Link
              key={organization.id}
              className="flex items-center justify-between rounded-xl border bg-background px-4 py-3 transition-colors hover:bg-muted/40"
              params={{ org: organization.slug }}
              to="/@{$org}"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{organization.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  /@{organization.slug}
                </p>
              </div>
              <span className="ml-3 shrink-0 rounded-full border px-2.5 py-1 text-xs text-muted-foreground capitalize">
                {organization.role} · {organization.visibility}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
