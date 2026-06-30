import { createFileRoute } from "@tanstack/react-router"
import { crpcServer } from "@/lib/convex/crpc-server"
import { titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/account/data/")({
  head: () => ({
    meta: [titleMeta(["Data", "Account"])],
  }),
  loader: async ({ context }) => {
    if (!context.loaderToken) {
      return
    }

    await Promise.all([
      context.queryClient.ensureQueryData(
        crpcServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
      ),
      context.queryClient.ensureQueryData(
        crpcServer.userDataExport.getAvailableSections.queryOptions(
          {},
          { skipUnauth: true }
        )
      ),
    ])
  },
})
