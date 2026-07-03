import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  FolderOpen,
  Globe,
  Lock,
  Settings,
  Users,
  Zap,
} from "lucide-react"

import { NoPublicProjects } from "./-components/no-public-projects"
import { OrgProjects } from "./-components/org-projects"
import { EmptyState } from "@/components/kino/common"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useCRPC } from "@/lib/convex/crpc"
import { crpcServer } from "@/lib/convex/crpc-server"
import { titleFromSlug, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/")({
  head: ({ params }) => ({
    meta: [titleMeta([titleFromSlug(params.org)])],
  }),
  loader: async ({ context, params }) => {
    const orgData = await context.queryClient.ensureQueryData(
      crpcServer.org.getDetails.queryOptions({
        slug: params.org,
      })
    )

    await context.queryClient.ensureQueryData(
      crpcServer.project.getManyByOrg.queryOptions({
        limit: 24,
        orgSlug: params.org,
      })
    )

    if (orgData?.permissions.canCreate) {
      await context.queryClient.ensureQueryData(
        crpcServer.org.getMyPermission.queryOptions(
          { slug: params.org },
          { skipUnauth: true }
        )
      )
    }
  },
  component: OrganizationRoute,
})

const PLACEHOLDER_ACTIVITY = [
  {
    id: 1,
    label: "Issue #42 closed",
    sub: "Bug: login redirect loop",
    time: "2h ago",
    color: "bg-green-500",
  },
  {
    id: 2,
    label: "New project created",
    sub: "mobile-app",
    time: "Yesterday",
    color: "bg-primary",
  },
  {
    id: 3,
    label: "Member joined",
    sub: "@alex joined the org",
    time: "3 days ago",
    color: "bg-violet-500",
  },
  {
    id: 4,
    label: "Issue #38 closed",
    sub: "Feat: dark mode toggle",
    time: "4 days ago",
    color: "bg-green-500",
  },
  {
    id: 5,
    label: "Issue #31 opened",
    sub: "Feat: API rate limiting",
    time: "1 week ago",
    color: "bg-amber-500",
  },
]

function OrganizationRoute() {
  const params = Route.useParams()
  const crpc = useCRPC()
  const { data: orgData } = useSuspenseQuery(
    crpc.org.getDetails.queryOptions({
      slug: params.org,
    })
  )
  const { data: projectsData } = useSuspenseQuery(
    crpc.project.getManyByOrg.queryOptions({
      limit: 24,
      orgSlug: params.org,
    })
  )
  const limitsQuery = useQuery(
    crpc.org.getMyPermission.queryOptions(
      { slug: params.org },
      { enabled: !!orgData?.permissions.canCreate, skipUnauth: true }
    )
  )
  const membersQuery = useQuery(
    crpc.orgMember.listMembers.queryOptions(
      { slug: params.org },
      { skipUnauth: true }
    )
  )
  const members = membersQuery.data?.members ?? []
  const canManageMembers = membersQuery.data?.canManage ?? false
  const projects = projectsData ?? []

  if (!orgData?.org) {
    return (
      <div className="container py-10">
        <EmptyState
          title="Organization not available"
          description="This organization either does not exist or your session cannot view it."
        />
      </div>
    )
  }

  const orgInitial = orgData.org.name[0]?.toUpperCase() ?? "?"
  const isPublic = orgData.org.visibility === "public"

  return (
    <div>
      {/* ── Hero ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b bg-card">
        {/* Subtle dot-grid background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* Primary glow in top-right */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl"
        />

        <div className="relative container py-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-5">
              {/* Org avatar */}
              <div className="relative shrink-0">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/20 md:h-20 md:w-20">
                  <span className="text-2xl font-bold text-primary-foreground md:text-3xl">
                    {orgInitial}
                  </span>
                </div>
                {/* Online dot */}
                <span className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-background">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                    {orgData.org.name}
                  </h1>
                  <Badge variant="outline" className="gap-1 text-xs">
                    {isPublic ? (
                      <Globe className="size-3" />
                    ) : (
                      <Lock className="size-3" />
                    )}
                    {isPublic ? "Public" : "Private"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {/* Placeholder description — swap for real org.description when available */}
                  Building the future, one project at a time.
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    {members.length} member{members.length === 1 ? "" : "s"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FolderOpen className="size-3.5" />
                    {projects.length} project{projects.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>

            {orgData.permissions.canEdit ? (
              <Button asChild variant="outline" className="shrink-0 self-start">
                <Link search={{ org: params.org }} to="/org/settings">
                  <Settings className="size-4" />
                  Settings
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Stats bar ─────────────────────────────────────── */}
      {projects.length > 0 && (
        <div className="border-b bg-muted/40">
          <div className="container">
            <div className="flex divide-x divide-border overflow-x-auto">
              <StatCell
                icon={<FolderOpen className="size-4 text-primary" />}
                value={projects.length}
                label="Active projects"
                real
              />
              <StatCell
                icon={<Users className="size-4 text-violet-500" />}
                value={members.length}
                label="Team members"
                real
              />
              <StatCell
                icon={<CheckCircle2 className="size-4 text-green-500" />}
                value={126}
                label="Closed this month"
              />
              <StatCell
                icon={<Zap className="size-4 text-amber-500" />}
                value={14}
                label="Open issues"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="container py-10">
        {projects.length === 0 ? (
          <NoPublicProjects
            canCreate={orgData.permissions.canCreate}
            orgName={orgData.org.name}
            orgSlug={params.org}
          />
        ) : (
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
            {/* ── Projects ───────────────────────────────── */}
            <section className="col-span-1 md:col-span-8">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Projects</h2>
                {orgData.permissions.canCreate &&
                limitsQuery.data?.canAddProjects ? (
                  <Link
                    className="inline-flex items-center gap-1 text-sm text-primary underline decoration-primary/40 decoration-2 underline-offset-2 hover:decoration-primary/70"
                    params={{ org: params.org }}
                    to="/@{$org}/create-project"
                  >
                    New project
                    <ArrowRight className="size-3.5" />
                  </Link>
                ) : null}
              </div>
              <OrgProjects orgSlug={params.org} projects={projects} />
            </section>

            {/* ── Sidebar ────────────────────────────────── */}
            <aside className="col-span-1 flex flex-col gap-8 md:col-span-4">
              {/* Members */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Members</h2>
                  {canManageMembers ? (
                    <Link
                      className="text-sm text-primary underline decoration-primary/40 decoration-2 underline-offset-2 hover:decoration-primary/70"
                      search={{ org: params.org }}
                      to="/org/settings/members"
                    >
                      Manage
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {members.length} total
                    </span>
                  )}
                </div>
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No members to show.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {members.slice(0, 5).map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 rounded-lg px-1 py-1"
                      >
                        <Avatar className="size-8 shrink-0">
                          {m.user.image ? (
                            <AvatarImage src={m.user.image} />
                          ) : null}
                          <AvatarFallback className="text-xs font-semibold">
                            {(m.user.name ?? m.user.email)[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {m.user.name ?? m.user.email}
                          </span>
                          <Badge
                            variant="outline"
                            className="shrink-0 text-[10px] text-muted-foreground capitalize"
                          >
                            {m.role}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {members.length > 5 && canManageMembers ? (
                      <Link
                        className="mt-1 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
                        search={{ org: params.org }}
                        to="/org/settings/members"
                      >
                        +{members.length - 5} more members
                      </Link>
                    ) : members.length > 5 ? (
                      <span className="mt-1 text-sm text-muted-foreground">
                        +{members.length - 5} more members
                      </span>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Activity</h2>
                  <Activity className="size-4 text-muted-foreground" />
                </div>
                <div className="relative flex flex-col gap-0">
                  {/* Vertical line */}
                  <div className="absolute top-0 bottom-0 left-[7px] w-px bg-border" />
                  {PLACEHOLDER_ACTIVITY.map((item) => (
                    <div
                      key={item.id}
                      className="relative flex gap-4 pb-5 last:pb-0"
                    >
                      <div
                        className={`relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-background ${item.color}`}
                      />
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm leading-snug font-medium">
                          {item.label}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {item.sub}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                          <Clock className="size-2.5" />
                          {item.time}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type StatCellProps = {
  icon: React.ReactNode
  value: number
  label: string
  real?: boolean
}

function StatCell({ icon, value, label, real }: StatCellProps) {
  return (
    <div className="flex min-w-[120px] flex-1 flex-col gap-1 px-6 py-4">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-gradient-primary text-2xl font-bold">
          {value}
        </span>
        {!real && (
          <span
            title="Placeholder number"
            className="text-[10px] text-muted-foreground/40"
          >
            ·
          </span>
        )}
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
