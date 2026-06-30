import { createFileRoute } from "@tanstack/react-router"

import { crpcServer } from "@/lib/convex/crpc-server"
import { titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/account/profile/")({
  head: () => ({
    meta: [titleMeta(["Profile", "Account"])],
  }),
  loader: async ({ context }) => {
    if (!context.loaderToken) {
      return
    }

    await context.queryClient.ensureQueryData(
      crpcServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
    )
  },
})
