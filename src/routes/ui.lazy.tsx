import { useMemo, useState } from "react"
import { Link, createLazyFileRoute } from "@tanstack/react-router"
import {
  ArrowLeft,
  Blocks,
  Layers,
  MoonIcon,
  Search,
  SunIcon,
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { COMPONENT_ITEMS } from "@/components/ui-lab/component-demos"
import { EXAMPLE_ITEMS } from "@/components/ui-lab/example-demos"
import { CopySnippet } from "@/components/ui-lab/parts"
import type { LabItem } from "@/components/ui-lab/types"
import { toggleThemePreference } from "@/lib/theme"
import { cn } from "@/lib/utils"

export const Route = createLazyFileRoute("/ui")({
  component: UiLibraryPage,
})

const SECTIONS: {
  id: string
  label: string
  icon: typeof Blocks
  items: LabItem[]
}[] = [
  {
    id: "components",
    label: "Components",
    icon: Blocks,
    items: COMPONENT_ITEMS,
  },
  { id: "examples", label: "Examples", icon: Layers, items: EXAMPLE_ITEMS },
]

const ALL_ITEMS = [...COMPONENT_ITEMS, ...EXAMPLE_ITEMS]

function UiLibraryPage() {
  const { item } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [query, setQuery] = useState("")

  const active = useMemo(
    () => ALL_ITEMS.find((entry) => entry.id === item) ?? ALL_ITEMS[0]!,
    [item]
  )

  const setActiveId = (id: string) =>
    navigate({ search: { item: id }, resetScroll: false })

  const sectionOf = SECTIONS.find((s) =>
    s.items.some((i) => i.id === active.id)
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return SECTIONS.map((section) => ({
      ...section,
      matches: q
        ? section.items.filter(
            (i) =>
              i.name.toLowerCase().includes(q) ||
              i.description.toLowerCase().includes(q)
          )
        : section.items,
    }))
  }, [query])

  return (
    <div className="flex min-h-svh bg-muted/30 text-foreground">
      {/* Sidebar */}
      <aside className="sticky top-0 flex h-svh w-72 shrink-0 flex-col border-r bg-card/60 backdrop-blur">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-tl from-primary to-blue-400 text-xs font-bold text-white shadow-sm">
              K
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">Kino UI</p>
              <p className="text-[11px] text-muted-foreground">
                Component library
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleThemePreference}
            aria-label="Toggle theme"
            className="relative flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:text-foreground"
          >
            <SunIcon className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
            <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          </button>
        </div>

        <div className="px-3 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="pl-8"
              size="sm"
            />
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
          {filtered.map((section) => {
            if (section.matches.length === 0) return null
            const Icon = section.icon
            return (
              <div key={section.id}>
                <div className="flex items-center gap-1.5 px-2 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  <Icon className="size-3" />
                  {section.label}
                  <span className="ml-auto font-mono text-[10px] tabular-nums opacity-60">
                    {section.matches.length}
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {section.matches.map((item) => {
                    const isActive = item.id === active.id
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setActiveId(item.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                            isActive
                              ? "bg-primary/10 font-medium text-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full transition-colors",
                              isActive ? "bg-primary" : "bg-transparent"
                            )}
                          />
                          <span className="truncate">{item.name}</span>
                          {item.tag && (
                            <span className="ml-auto rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">
                              {item.tag}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
          {filtered.every((s) => s.matches.length === 0) && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No components match “{query}”.
            </p>
          )}
        </nav>

        <div className="border-t p-3">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to app
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex h-svh min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/70 px-8 py-3 text-sm text-muted-foreground backdrop-blur">
          <span>{sectionOf?.label ?? "Components"}</span>
          <span className="opacity-40">/</span>
          <span className="font-medium text-foreground">{active.name}</span>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-8 py-10">
            <div className="mb-8 space-y-3">
              <div className="space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {active.name}
                </h1>
                <p className="text-muted-foreground">{active.description}</p>
              </div>
              {active.importCode && <CopySnippet code={active.importCode} />}
            </div>
            <div className="space-y-10">{active.render()}</div>
          </div>
        </div>
      </main>
    </div>
  )
}
