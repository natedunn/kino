import { createFileRoute, notFound } from "@tanstack/react-router"

import { crpcServer } from "@/lib/convex/crpc-server"
import { projectTitle, titleFromSlug, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/$project/updates/$slug/edit")({
  loader: async ({ context, params }) => {
    const projectData = await context.queryClient.ensureQueryData(
      crpcServer.project.getDetails.queryOptions({
        orgSlug: params.org,
        slug: params.project,
      })
    )

    if (!projectData?.project?.id) {
      throw notFound()
    }

    const updateData = await context.queryClient.ensureQueryData(
      crpcServer.update.getBySlug.queryOptions({
        projectId: projectData.project.id,
        slug: params.slug,
      })
    )

    if (!updateData?.update) {
      throw notFound()
    }

    return {
      title: updateData.update.title,
    }
  },
  head: ({ loaderData, params }) => ({
    meta: [
      titleMeta([
        loaderData?.title ?? titleFromSlug(params.slug),
        projectTitle(params.org, params.project),
      ]),
    ],
  }),
})
