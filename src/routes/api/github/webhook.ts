import { createFileRoute } from "@tanstack/react-router"

import { handler } from "@/lib/convex/github-server"

export const Route = createFileRoute("/api/github/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => handler(request),
    },
  },
})
