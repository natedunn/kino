import { createFileRoute } from "@tanstack/react-router"

import { projectTitle, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/$project/files/")({
  head: ({ params }) => ({
    meta: [titleMeta(["Files", projectTitle(params.org, params.project)])],
  }),
})
