import { createFileRoute } from "@tanstack/react-router"

import { titleFromSlug, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/create-project/")({
  head: ({ params }) => ({
    meta: [titleMeta(["Create Project", titleFromSlug(params.org)])],
  }),
})
