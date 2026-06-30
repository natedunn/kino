import { createFileRoute } from "@tanstack/react-router"

import { titleMeta } from "@/lib/seo"

type UiSearch = { item?: string }

export const Route = createFileRoute("/ui")({
  head: () => ({
    meta: [titleMeta(["UI Library"])],
  }),
  validateSearch: (search: Record<string, unknown>): UiSearch => ({
    item: typeof search.item === "string" ? search.item : undefined,
  }),
})
