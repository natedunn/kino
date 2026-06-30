import { createFileRoute } from "@tanstack/react-router"
import { requireAuth } from "@/lib/auth/require-auth"
import { crpcServer } from "@/lib/convex/crpc-server"
import { titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [titleMeta(["Dashboard"])],
  }),
  beforeLoad: ({ context, location }) => requireAuth(context, location),
  loader: async ({ context }) => {
    if (!context.loaderToken) {
      return
    }

    await Promise.all([
      context.queryClient.ensureQueryData(
        crpcServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
      ),
      context.queryClient.ensureQueryData(
        crpcServer.org.findMyOrgs.queryOptions({}, { skipUnauth: true })
      ),
    ])
  },
})
