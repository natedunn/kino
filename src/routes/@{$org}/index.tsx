import { createFileRoute } from "@tanstack/react-router"

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
})
