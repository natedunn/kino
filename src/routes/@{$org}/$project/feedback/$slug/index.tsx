import { createFileRoute, notFound } from "@tanstack/react-router"

import { crpcServer } from "@/lib/convex/crpc-server"
import { projectTitle, titleFromSlug, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/$project/feedback/$slug/")({
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

    const feedbackData = await context.queryClient.ensureQueryData(
      crpcServer.feedback.getDetailCritical.queryOptions({
        projectId: projectData.project.id,
        slug: params.slug,
      })
    )

    if (!feedbackData?.feedback) {
      throw notFound()
    }

    return {
      createdAt: feedbackData.feedback.createdAt,
      feedbackId: feedbackData.feedback.id,
      projectId: projectData.project.id,
      status: feedbackData.feedback.status,
      title: feedbackData.feedback.title,
      upvotes: feedbackData.feedback.upvotes,
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
