import { createFileRoute, notFound } from "@tanstack/react-router"

import { RoutePending } from "@/components/route-pending"
import { crpcServer } from "@/lib/convex/crpc-server"
import { projectTitle, titleMeta } from "@/lib/seo"

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZES = new Set([10, 20, 50])

function validateDashboardSearch(search: Record<string, unknown>): {
  pageSize: 10 | 20 | 50
} {
  const pageSize = Number(search.pageSize)
  return {
    pageSize: PAGE_SIZES.has(pageSize)
      ? (pageSize as 10 | 20 | 50)
      : DEFAULT_PAGE_SIZE,
  }
}

export const Route = createFileRoute("/@{$org}/$project/updates/edit/")({
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps, params }) => {
    const projectData = await context.queryClient.ensureQueryData(
      crpcServer.project.getDetails.queryOptions({
        orgSlug: params.org,
        slug: params.project,
      })
    )

    if (!projectData?.project) {
      throw notFound()
    }

    if (!projectData.permissions.canEdit) {
      return
    }

    await context.queryClient.ensureQueryData(
      crpcServer.update.listProjectDashboard.queryOptions({
        cursor: null,
        limit: deps.pageSize,
        projectId: projectData.project.id,
      })
    )
  },
  pendingComponent: () => <RoutePending variant="page" />,
  pendingMs: 600,
  validateSearch: validateDashboardSearch,
  head: ({ params }) => ({
    meta: [
      titleMeta(["Manage Updates", projectTitle(params.org, params.project)]),
    ],
  }),
})
