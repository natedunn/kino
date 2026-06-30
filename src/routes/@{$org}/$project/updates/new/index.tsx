import { createFileRoute } from "@tanstack/react-router"

import { projectTitle, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/$project/updates/new/")({
  head: ({ params }) => ({
    meta: [titleMeta(["New Update", projectTitle(params.org, params.project)])],
  }),
})
