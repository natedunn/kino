import { createFileRoute } from "@tanstack/react-router"

import { handler } from "@/lib/convex/github-server"

export const Route = createFileRoute("/api/github/oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => handler(request),
    },
  },
})
