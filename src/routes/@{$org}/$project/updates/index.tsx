import type { ReactNode } from "react"

import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { z } from "zod"

import { RoutePending } from "@/components/route-pending"
import { Button } from "@/components/ui/button"
import CalendarDays from "@/icons/calendar-days"
import CirclePlusOutline from "@/icons/circle-plus-outline"
import Missing from "@/icons/missing"
import { Settings2 } from "lucide-react"
import { useCRPC } from "@/lib/convex/crpc"
import { crpcServer } from "@/lib/convex/crpc-server"

import { CategoriesNav } from "./-components/categories-nav"
import { UpdateCard } from "./-components/update-card"

const updatesSearchParams = z.object({
  category: z.optional(
    z
      .enum(["changelog", "article", "announcement"])
      .transform((value) => (value?.trim() === "" ? undefined : value))
  ),
})

export const Route = createFileRoute("/@{$org}/$project/updates/")({
  component: UpdatesListRoute,
  loader: async ({ context, params }) => {
    const projectData = await context.queryClient.ensureQueryData(
      crpcServer.project.getDetails.queryOptions({
        orgSlug: params.org,
        slug: params.project,
      })
    )

    if (!projectData?.project) {
      throw notFound()
    }

    await Promise.all([
      context.queryClient.ensureQueryData(
        crpcServer.update.listByProject.queryOptions({
          projectId: projectData.project.id,
        })
      ),
      context.queryClient.ensureQueryData(
        crpcServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
      ),
    ])
  },
  pendingComponent: () => <RoutePending variant="page" />,
  pendingMs: 600,
  validateSearch: updatesSearchParams,
})

function Notice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="text-bold flex items-center justify-center gap-3 rounded-lg border bg-muted p-4 text-xl text-muted-foreground md:p-10">
      <div>{icon}</div>
      <div>{children}</div>
    </div>
  )
}

function UpdatesListRoute() {
  const { org: orgSlug, project: projectSlug } = Route.useParams()
  const { category: categoryParam } = Route.useSearch()
  const crpc = useCRPC()

  const { data: projectData } = useSuspenseQuery(
    crpc.project.getDetails.queryOptions({
      orgSlug,
      slug: projectSlug,
    })
  )

  if (!projectData?.project) {
    throw notFound()
  }

  const updatesQuery = useSuspenseQuery(
    crpc.update.listByProject.queryOptions({
      projectId: projectData.project.id,
    })
  )
  const currentProfileQuery = useSuspenseQuery(
    crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
  )

  const allUpdates = updatesQuery.data?.updates ?? []
  const canEdit = updatesQuery.data?.canEdit ?? false
  const updates = categoryParam
    ? allUpdates.filter((update) => update.category === categoryParam)
    : allUpdates

  return (
    <div className="container flex flex-1 flex-col overflow-visible">
      <div className="flex flex-1 flex-col gap-8 md:grid md:grid-cols-12">
        <div className="order-last py-6 md:col-span-3 md:border-l md:border-border/75">
          <div className="sticky top-6 flex flex-col overflow-hidden">
            <div className="pb-6 md:pl-6">
              <h2 className="mx-2 text-sm font-bold text-muted-foreground">
                Categories
              </h2>
              <div className="mt-2">
                <CategoriesNav />
              </div>
            </div>
            {canEdit ? (
              <div className="border-t pt-6 md:pl-6">
                <h2 className="mx-2 text-sm font-bold text-muted-foreground">
                  Actions
                </h2>
                <div className="mt-2 flex flex-col gap-3">
                  <Button asChild className="w-full">
                    <Link
                      params={{ org: orgSlug, project: projectSlug }}
                      to="/@{$org}/$project/updates/new"
                    >
                      <CirclePlusOutline size="16px" /> New Update
                    </Link>
                  </Button>
                  <Button asChild className="w-full" variant="outline">
                    <Link
                      params={{ org: orgSlug, project: projectSlug }}
                      search={{ pageSize: 20 }}
                      to="/@{$org}/$project/updates/edit"
                    >
                      <Settings2 className="size-4" /> Manage Updates
                    </Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div
          className="flex flex-col gap-4 py-8 md:col-span-9"
          aria-busy={updatesQuery.isFetching}
          aria-live="polite"
        >
          <div className="flex items-start gap-3 border-b pt-6 pb-6 md:-mr-8.25">
            <CalendarDays className="mt-1 text-muted-foreground" size="28px" />
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-bold">Updates</h1>
              <p className="text-muted-foreground">
                The latest news and announcements.
              </p>
            </div>
          </div>

          {updates.length === 0 ? (
            <Notice icon={<Missing aria-hidden="true" size="32px" />}>
              No updates yet.
            </Notice>
          ) : null}
          {updates.length > 0 ? (
            <ul className="flex flex-col">
              {updates.map((update, index) => (
                <UpdateCard
                  key={update.id}
                  currentProfileId={currentProfileQuery.data?.id}
                  isLast={index === updates.length - 1}
                  orgSlug={orgSlug}
                  projectSlug={projectSlug}
                  update={update}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  )
}
