import { createFileRoute } from "@tanstack/react-router"

import { crpcServer } from "@/lib/convex/crpc-server"
import { titleMeta } from "@/lib/seo"

export const Route = createFileRoute(
  "/@{$org}/$project/settings/integrations/"
)({
  head: () => ({
    meta: [titleMeta(["Integrations"])],
  }),
  loader: async ({ context, params }) => {
    if (!context.loaderToken) return
    await context.queryClient.ensureQueryData(
      crpcServer.github.getProjectIntegration.queryOptions({
        orgSlug: params.org,
        projectSlug: params.project,
      })
    )
  },
})
