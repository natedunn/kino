import { useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { createFileRoute } from "@tanstack/react-router"
import {
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  LayoutGrid,
  List,
  MessageSquare,
  Milestone,
  Search,
} from "lucide-react"

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import type { Icon as IconType } from "@/icons/types"
import { GithubIcon } from "@/icons"

import { Badge } from "@/components/ui/badge"
import CircleCheck from "@/icons/circle-check"
import CircleDot from "@/icons/circle-dot"
import CirclePlay from "@/icons/circle-play"
import HourglassStart from "@/icons/hourglass-start"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/@{$org}/$project/roadmap/")({
  component: RoadmapPage,
})

// ─── Types ────────────────────────────────────────────────────────────────────

type RoadmapStatus = "backlog" | "planned" | "in-progress" | "released"
type ViewMode = "board" | "list" | "timeline"

interface RoadmapItem {
  id: string
  title: string
  status: RoadmapStatus
  tags: Array<string>
  upvotes: number
  feedbackCount: number
  githubIssues: number
  quarter: string
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_ITEMS: Array<RoadmapItem> = [
  // Backlog
  {
    id: "1",
    title: "Advanced search with smart filters",
    status: "backlog",
    tags: ["Feedback", "UX"],
    upvotes: 47,
    feedbackCount: 12,
    githubIssues: 0,
    quarter: "Q4 2025",
  },
  {
    id: "2",
    title: "Custom notification preferences",
    status: "backlog",
    tags: ["Settings"],
    upvotes: 31,
    feedbackCount: 8,
    githubIssues: 0,
    quarter: "Q4 2025",
  },
  {
    id: "3",
    title: "Data export (CSV & JSON)",
    status: "backlog",
    tags: ["Data", "Admin"],
    upvotes: 89,
    feedbackCount: 23,
    githubIssues: 2,
    quarter: "Q1 2026",
  },
  {
    id: "4",
    title: "Team @mentions in comments",
    status: "backlog",
    tags: ["Collaboration"],
    upvotes: 22,
    feedbackCount: 6,
    githubIssues: 0,
    quarter: "Q1 2026",
  },

  // Planned
  {
    id: "5",
    title: "Roadmap public sharing & embed",
    status: "planned",
    tags: ["Roadmap", "Public"],
    upvotes: 134,
    feedbackCount: 31,
    githubIssues: 3,
    quarter: "Q3 2025",
  },
  {
    id: "6",
    title: "GitHub issue bidirectional sync",
    status: "planned",
    tags: ["GitHub", "Integration"],
    upvotes: 203,
    feedbackCount: 44,
    githubIssues: 7,
    quarter: "Q3 2025",
  },
  {
    id: "7",
    title: "Custom status labels per project",
    status: "planned",
    tags: ["Customization"],
    upvotes: 56,
    feedbackCount: 14,
    githubIssues: 1,
    quarter: "Q3 2025",
  },
  {
    id: "8",
    title: "Admin upvote limit configuration",
    status: "planned",
    tags: ["Admin"],
    upvotes: 18,
    feedbackCount: 5,
    githubIssues: 0,
    quarter: "Q4 2025",
  },

  // In Progress
  {
    id: "9",
    title: "Feedback voting system v2",
    status: "in-progress",
    tags: ["Feedback", "Core"],
    upvotes: 312,
    feedbackCount: 67,
    githubIssues: 11,
    quarter: "Q3 2025",
  },
  {
    id: "10",
    title: "Integration marketplace",
    status: "in-progress",
    tags: ["Integrations"],
    upvotes: 178,
    feedbackCount: 39,
    githubIssues: 5,
    quarter: "Q3 2025",
  },
  {
    id: "11",
    title: "Rich text comment editor",
    status: "in-progress",
    tags: ["Comments", "UX"],
    upvotes: 91,
    feedbackCount: 21,
    githubIssues: 2,
    quarter: "Q3 2025",
  },

  // Released
  {
    id: "12",
    title: "Webhook integrations",
    status: "released",
    tags: ["Integrations", "API"],
    upvotes: 445,
    feedbackCount: 89,
    githubIssues: 14,
    quarter: "Q2 2025",
  },
  {
    id: "13",
    title: "SSO & SAML support",
    status: "released",
    tags: ["Auth", "Enterprise"],
    upvotes: 521,
    feedbackCount: 103,
    githubIssues: 8,
    quarter: "Q2 2025",
  },
  {
    id: "14",
    title: "Comment emoji reactions",
    status: "released",
    tags: ["Comments", "UX"],
    upvotes: 234,
    feedbackCount: 52,
    githubIssues: 3,
    quarter: "Q1 2025",
  },
  {
    id: "15",
    title: "CSV data import",
    status: "released",
    tags: ["Data", "Admin"],
    upvotes: 167,
    feedbackCount: 38,
    githubIssues: 6,
    quarter: "Q1 2025",
  },
  {
    id: "16",
    title: "Email digest notifications",
    status: "released",
    tags: ["Notifications"],
    upvotes: 389,
    feedbackCount: 77,
    githubIssues: 9,
    quarter: "Q1 2025",
  },
]

// ─── Config ───────────────────────────────────────────────────────────────────

interface StatusConfig {
  label: string
  Icon: IconType
  colorClass: string
  bgClass: string
  borderClass: string
  leftBorderClass: string
}

const STATUS_CONFIG: Record<RoadmapStatus, StatusConfig> = {
  backlog: {
    label: "Backlog",
    Icon: CircleDot,
    colorClass: "text-blue-500 dark:text-blue-400",
    bgClass: "bg-blue-50 dark:bg-blue-500/10",
    borderClass: "border-blue-200 dark:border-blue-900",
    leftBorderClass: "border-l-blue-400 dark:border-l-blue-500",
  },
  planned: {
    label: "Planned",
    Icon: HourglassStart,
    colorClass: "text-amber-500 dark:text-amber-400",
    bgClass: "bg-amber-50 dark:bg-amber-500/10",
    borderClass: "border-amber-200 dark:border-amber-900",
    leftBorderClass: "border-l-amber-400 dark:border-l-amber-500",
  },
  "in-progress": {
    label: "In Progress",
    Icon: CirclePlay,
    colorClass: "text-violet-500 dark:text-violet-400",
    bgClass: "bg-violet-50 dark:bg-violet-500/10",
    borderClass: "border-violet-200 dark:border-violet-900",
    leftBorderClass: "border-l-violet-400 dark:border-l-violet-500",
  },
  released: {
    label: "Released",
    Icon: CircleCheck,
    colorClass: "text-emerald-500 dark:text-emerald-400",
    bgClass: "bg-emerald-50 dark:bg-emerald-500/10",
    borderClass: "border-emerald-200 dark:border-emerald-900",
    leftBorderClass: "border-l-emerald-400 dark:border-l-emerald-500",
  },
}

const STATUSES: Array<RoadmapStatus> = [
  "backlog",
  "planned",
  "in-progress",
  "released",
]
const LIST_ORDER: Array<RoadmapStatus> = [
  "in-progress",
  "planned",
  "backlog",
  "released",
]
const QUARTERS = ["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025", "Q1 2026"]
const CURRENT_QUARTER = "Q3 2025"

// ─── Drag & Drop ─────────────────────────────────────────────────────────────

type DragHandle = Pick<
  ReturnType<typeof useDraggable>,
  "listeners" | "attributes"
>

// ─── Board Card ───────────────────────────────────────────────────────────────

function BoardCard({
  item,
  dragHandle,
  isDragging = false,
  isOverlay = false,
}: {
  item: RoadmapItem
  dragHandle?: DragHandle
  isDragging?: boolean
  isOverlay?: boolean
}) {
  return (
    <div
      className={cn(
        "group rounded-lg border bg-card p-3.5 transition-all duration-150",
        !isOverlay &&
          "cursor-pointer hover:border-foreground/20 hover:shadow-sm dark:hover:border-foreground/10",
        isOverlay &&
          "rotate-[1.5deg] border-foreground/15 shadow-xl dark:border-foreground/10",
        isDragging && "scale-[0.98] opacity-30"
      )}
    >
      <p
        className={cn(
          "mb-2.5 text-sm leading-snug font-medium transition-colors",
          !isOverlay && "group-hover:text-primary"
        )}
      >
        {item.title}
      </p>
      <div className="mb-3 flex flex-wrap gap-1">
        {item.tags.map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className="h-4 border-border/60 py-0 text-[10px] font-normal text-muted-foreground"
          >
            {tag}
          </Badge>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {item.feedbackCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="size-3" />
              {item.feedbackCount}
            </span>
          )}
          {item.githubIssues > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <GithubIcon className="size-3" />
              {item.githubIssues}
            </span>
          )}
        </div>
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <ChevronUp className="size-3" />
          {item.upvotes}
        </span>
      </div>

      {/* Grab handle — admin / editor only */}
      {dragHandle && (
        <div
          {...dragHandle.listeners}
          {...dragHandle.attributes}
          className="-mx-3.5 mt-3 -mb-3.5 flex cursor-grab items-center justify-center rounded-b-lg border-t bg-muted py-1.5 transition-colors hover:bg-accent active:cursor-grabbing"
        >
          <GripHorizontal className="size-3 text-muted-foreground" />
        </div>
      )}
    </div>
  )
}

// ─── Draggable Board Card ─────────────────────────────────────────────────────

function DraggableBoardCard({ item }: { item: RoadmapItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item },
  })

  return (
    <div ref={setNodeRef}>
      <BoardCard
        item={item}
        dragHandle={{ listeners, attributes }}
        isDragging={isDragging}
      />
    </div>
  )
}

// ─── Droppable Column ─────────────────────────────────────────────────────────

function DroppableColumn({
  status,
  items,
  className,
  hideHeader = false,
}: {
  status: RoadmapStatus
  items: Array<RoadmapItem>
  className?: string
  hideHeader?: boolean
}) {
  const config = STATUS_CONFIG[status]
  const { Icon } = config
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[272px] shrink-0 flex-col self-start rounded-xl transition-all duration-150",
        isOver && "ring-2 ring-primary/40",
        className
      )}
    >
      {/* Column header — hidden on mobile (parent renders the select instead) */}
      {!hideHeader && (
        <div
          className={cn(
            "mb-3 flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors",
            isOver
              ? "border-primary/30 bg-primary/10"
              : cn(config.bgClass, config.borderClass)
          )}
        >
          <div className="flex items-center gap-2">
            <Icon className={cn("size-3.5", config.colorClass)} />
            <span className="text-xs font-semibold">{config.label}</span>
          </div>
          <span
            className={cn(
              "font-mono text-[10px] font-semibold tabular-nums",
              config.colorClass
            )}
          >
            {items.length}
          </span>
        </div>
      )}

      {/* Card area */}
      <div
        className={cn(
          "flex min-h-[160px] flex-col gap-2 transition-colors duration-150",
          !hideHeader && "rounded-b-xl",
          isOver && "bg-primary/5"
        )}
      >
        {items.map((item) => (
          <DraggableBoardCard key={item.id} item={item} />
        ))}
        {items.length === 0 && (
          <div
            className={cn(
              "flex items-center justify-center rounded-lg border border-dashed py-10 transition-colors",
              isOver ? "border-primary/40 bg-primary/5" : "bg-muted/30"
            )}
          >
            <span className="text-xs text-muted-foreground/50">
              {isOver ? "Drop here" : "No items yet"}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Board View ───────────────────────────────────────────────────────────────

function BoardView() {
  const [items, setItems] = useState<Array<RoadmapItem>>(MOCK_ITEMS)
  const [activeItem, setActiveItem] = useState<RoadmapItem | null>(null)
  const [mobileStatus, setMobileStatus] = useState<RoadmapStatus>("in-progress")

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const itemsByStatus = Object.fromEntries(
    STATUSES.map((s) => [s, items.filter((i) => i.status === s)])
  ) as Record<RoadmapStatus, Array<RoadmapItem>>

  function handleDragStart(event: DragStartEvent) {
    const dragged = event.active.data.current?.item as RoadmapItem | undefined
    setActiveItem(dragged ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveItem(null)
    if (!over) return
    const itemId = active.id as string
    const newStatus = over.id as RoadmapStatus
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, status: newStatus } : item
      )
    )
  }

  const mobileConfig = STATUS_CONFIG[mobileStatus]
  const MobileIcon = mobileConfig.Icon

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* ── Mobile (<sm): native-select header + single full-width column ── */}
      <div className="flex flex-col gap-3 px-4 py-4 sm:hidden">
        {/* Styled select — count left, label, chevron right */}
        <div className="relative">
          <div
            className={cn(
              "pointer-events-none flex items-center gap-2.5 rounded-lg border px-3 py-2.5",
              mobileConfig.bgClass,
              mobileConfig.borderClass
            )}
          >
            <span
              className={cn(
                "font-mono text-[10px] font-semibold tabular-nums",
                mobileConfig.colorClass
              )}
            >
              {itemsByStatus[mobileStatus].length}
            </span>
            <MobileIcon className={cn("size-3.5", mobileConfig.colorClass)} />
            <span className="flex-1 text-xs font-semibold">
              {mobileConfig.label}
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </div>
          <select
            value={mobileStatus}
            onChange={(e) => setMobileStatus(e.target.value as RoadmapStatus)}
            className="absolute inset-0 w-full cursor-pointer opacity-0"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_CONFIG[s].label} ({itemsByStatus[s].length})
              </option>
            ))}
          </select>
        </div>

        {/* Cards — full width, no header (select above replaces it) */}
        <DroppableColumn
          status={mobileStatus}
          items={itemsByStatus[mobileStatus]}
          className="w-full"
          hideHeader
        />
      </div>

      {/* ── sm+: wrapping grid (2-col → 4-col at lg) ── */}
      <div className="hidden sm:block py-6">
        <div className="container grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STATUSES.map((status) => (
            <DroppableColumn
              key={status}
              status={status}
              items={itemsByStatus[status]}
              className="w-full"
            />
          ))}
        </div>
      </div>

      {/* Fixed width wrapper prevents the overlay card from collapsing */}
      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <div className="w-[272px]">
            <BoardCard item={activeItem} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// ─── List Item ────────────────────────────────────────────────────────────────

function ListItem({ item }: { item: RoadmapItem }) {
  const config = STATUS_CONFIG[item.status]
  const { Icon } = config

  return (
    <div
      className={cn(
        "flex items-center gap-4 bg-card px-4 py-3 hover:bg-accent/50",
        "group cursor-pointer border-l-2 transition-colors",
        config.leftBorderClass
      )}
    >
      <Icon className={cn("size-3.5 shrink-0", config.colorClass)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium transition-colors group-hover:text-primary">
          {item.title}
        </p>
      </div>
      <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
        {item.tags.slice(0, 2).map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className="h-4 py-0 text-[10px] font-normal text-muted-foreground"
          >
            {tag}
          </Badge>
        ))}
      </div>
      <span className="hidden w-16 shrink-0 text-right text-xs text-muted-foreground md:block">
        {item.quarter}
      </span>
      <div className="flex shrink-0 items-center gap-4">
        {item.feedbackCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="size-3" />
            {item.feedbackCount}
          </span>
        )}
        {item.githubIssues > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <GithubIcon className="size-3" />
            {item.githubIssues}
          </span>
        )}
        <span className="flex w-9 items-center justify-end gap-1 text-xs font-medium text-muted-foreground">
          <ChevronUp className="size-3" />
          {item.upvotes}
        </span>
      </div>
    </div>
  )
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView() {
  return (
    <div className="container py-6">
      <div className="flex flex-col gap-6">
        {LIST_ORDER.map((status) => {
          const items = MOCK_ITEMS.filter((i) => i.status === status)
          if (items.length === 0) return null
          const config = STATUS_CONFIG[status]
          const { Icon } = config

          return (
            <div key={status}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <Icon className={cn("size-3.5", config.colorClass)} />
                <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  {config.label}
                </h2>
                <span
                  className={cn(
                    "ml-1 font-mono text-[10px] font-semibold",
                    config.colorClass
                  )}
                >
                  {items.length}
                </span>
              </div>
              <div className="divide-y divide-border/50 overflow-hidden rounded-lg border">
                {items.map((item) => (
                  <ListItem key={item.id} item={item} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Timeline Card ────────────────────────────────────────────────────────────

function TimelineCard({ item }: { item: RoadmapItem }) {
  const config = STATUS_CONFIG[item.status]
  const { Icon } = config

  return (
    <div className="group cursor-pointer rounded-md border bg-card p-2.5 transition-all hover:border-foreground/15 hover:shadow-sm dark:hover:border-foreground/10">
      <div className="mb-2 flex items-start gap-1.5">
        <Icon className={cn("mt-0.5 size-3 shrink-0", config.colorClass)} />
        <p className="text-xs leading-snug font-medium transition-colors group-hover:text-primary">
          {item.title}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 gap-1 overflow-hidden">
          {item.tags.slice(0, 1).map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="h-3.5 shrink-0 px-1 py-0 text-[9px] font-normal text-muted-foreground"
            >
              {tag}
            </Badge>
          ))}
        </div>
        <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
          <ChevronUp className="size-2.5" />
          {item.upvotes}
        </span>
      </div>
    </div>
  )
}

// ─── Timeline View ────────────────────────────────────────────────────────────

function TimelineView() {
  const itemsByQuarter: Record<string, Array<RoadmapItem>> = {}
  for (const q of QUARTERS) {
    itemsByQuarter[q] = MOCK_ITEMS.filter((i) => i.quarter === q)
  }
  const currentIndex = QUARTERS.indexOf(CURRENT_QUARTER)

  return (
    <div className="overflow-x-auto py-6">
      <div className="min-w-max px-6">
        {/* Quarter grid */}
        <div className="relative flex">
          {/* Connecting timeline line */}
          <div
            className="pointer-events-none absolute h-px bg-border"
            style={{
              top: "28px",
              left: "110px",
              right: "110px",
            }}
          />

          {QUARTERS.map((quarter, index) => {
            const isPast = index < currentIndex
            const isCurrent = quarter === CURRENT_QUARTER
            const qItems = itemsByQuarter[quarter] ?? []

            return (
              <div key={quarter} className="w-[220px] shrink-0 px-3">
                {/* Quarter marker */}
                <div className="mb-6 flex flex-col items-center">
                  <span
                    className={cn(
                      "mb-3 text-[11px] font-semibold",
                      isCurrent
                        ? "text-primary"
                        : isPast
                          ? "text-muted-foreground"
                          : "text-foreground/60"
                    )}
                  >
                    {quarter}
                    {isCurrent && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/15 px-1.5 py-px text-[9px] font-bold tracking-wide text-primary uppercase">
                        Now
                      </span>
                    )}
                  </span>

                  {/* Timeline dot */}
                  <div
                    className={cn(
                      "relative z-10 size-3 rounded-full border-2 transition-all",
                      isCurrent
                        ? "border-primary bg-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--color-primary)_15%,transparent)]"
                        : isPast
                          ? "border-emerald-500 bg-emerald-500"
                          : "border-border bg-background"
                    )}
                  />
                </div>

                {/* Items */}
                <div className="flex flex-col gap-2">
                  {qItems.map((item) => (
                    <TimelineCard key={item.id} item={item} />
                  ))}
                  {qItems.length === 0 && (
                    <div className="flex h-16 items-center justify-center rounded-md border border-dashed">
                      <span className="text-xs text-muted-foreground/40">
                        —
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const VIEW_OPTIONS: Array<{
  mode: ViewMode
  label: string
  Icon: typeof LayoutGrid
}> = [
  { mode: "board", label: "Board", Icon: LayoutGrid },
  { mode: "list", label: "List", Icon: List },
  { mode: "timeline", label: "Timeline", Icon: Milestone },
]

function RoadmapPage() {
  const [view, setView] = useState<ViewMode>("board")
  const [search, setSearch] = useState("")

  return (
    <div className="flex flex-1 flex-col">
      {/* Toolbar */}
      <div className="border-b">
        <div className="container flex items-center justify-between gap-4 py-3">
          {/* View toggle — left */}
          <div className="flex items-center gap-0.5 rounded-lg border bg-muted/70 p-1">
            {VIEW_OPTIONS.map(({ mode, label, Icon: ViewIcon }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  view === mode
                    ? "border border-border/60 bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ViewIcon className="size-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Search — right */}
          <div className="relative w-52">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search roadmap…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border bg-muted/50 py-1.5 pr-3 pl-8 text-xs transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* View content */}
      {view === "board" && <BoardView />}
      {view === "list" && <ListView />}
      {view === "timeline" && <TimelineView />}
    </div>
  )
}
