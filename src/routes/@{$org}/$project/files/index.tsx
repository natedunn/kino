"use client"

import {
  
  
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table"
import { createFileRoute } from "@tanstack/react-router"
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  File,
  FileImage,
  FileText,
  FileVideo,
  Filter,
  HardDrive,
  Link2,
  MoreHorizontal,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"
import type {ColumnDef, SortingState} from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { projectTitle, titleMeta } from "@/lib/seo"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/@{$org}/$project/files/")({
  head: ({ params }) => ({
    meta: [titleMeta(["Files", projectTitle(params.org, params.project)])],
  }),
  component: FilesPage,
})

// ─── Types ────────────────────────────────────────────────────────────────────

type FileSource = "hosted" | "google-drive"
type FileKind = "image" | "video" | "document" | "other"

interface ProjectFile {
  id: string
  name: string
  kind: FileKind
  mimeType: string
  size: number | null // null for Google Drive files
  source: FileSource
  url: string
  thumbnailUrl: string | null
  uploadedBy: string
  uploadedAt: Date
  driveId?: string
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_FILES: Array<ProjectFile> = [
  {
    id: "f1",
    name: "hero-banner-v3.png",
    kind: "image",
    mimeType: "image/png",
    size: 2_340_000,
    source: "hosted",
    url: "#",
    thumbnailUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=80&h=80&fit=crop",
    uploadedBy: "Nate Dunn",
    uploadedAt: new Date("2026-06-10T14:23:00"),
  },
  {
    id: "f2",
    name: "product-demo-final.mp4",
    kind: "video",
    mimeType: "video/mp4",
    size: 48_200_000,
    source: "hosted",
    url: "#",
    thumbnailUrl: null,
    uploadedBy: "Sarah Kim",
    uploadedAt: new Date("2026-06-09T09:15:00"),
  },
  {
    id: "f3",
    name: "Q2 Design Spec",
    kind: "document",
    mimeType: "application/vnd.google-apps.document",
    size: null,
    source: "google-drive",
    url: "#",
    thumbnailUrl: null,
    uploadedBy: "James Park",
    uploadedAt: new Date("2026-06-08T16:40:00"),
    driveId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs",
  },
  {
    id: "f4",
    name: "logo-dark.svg",
    kind: "image",
    mimeType: "image/svg+xml",
    size: 8_400,
    source: "hosted",
    url: "#",
    thumbnailUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=80&h=80&fit=crop",
    uploadedBy: "Nate Dunn",
    uploadedAt: new Date("2026-06-07T11:05:00"),
  },
  {
    id: "f5",
    name: "Brand Assets – Kino",
    kind: "other",
    mimeType: "application/vnd.google-apps.folder",
    size: null,
    source: "google-drive",
    url: "#",
    thumbnailUrl: null,
    uploadedBy: "Sarah Kim",
    uploadedAt: new Date("2026-06-06T13:30:00"),
    driveId: "0B7l5uajXXXXXXXXXX",
  },
  {
    id: "f6",
    name: "onboarding-flow.webm",
    kind: "video",
    mimeType: "video/webm",
    size: 12_700_000,
    source: "hosted",
    url: "#",
    thumbnailUrl: null,
    uploadedBy: "Maria Chen",
    uploadedAt: new Date("2026-06-05T10:00:00"),
  },
  {
    id: "f7",
    name: "release-notes-v2.1.pdf",
    kind: "document",
    mimeType: "application/pdf",
    size: 1_100_000,
    source: "hosted",
    url: "#",
    thumbnailUrl: null,
    uploadedBy: "James Park",
    uploadedAt: new Date("2026-06-04T17:20:00"),
  },
  {
    id: "f8",
    name: "screenshot-dark-mode.jpg",
    kind: "image",
    mimeType: "image/jpeg",
    size: 890_000,
    source: "hosted",
    url: "#",
    thumbnailUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=80&h=80&fit=crop",
    uploadedBy: "Nate Dunn",
    uploadedAt: new Date("2026-06-03T08:45:00"),
  },
  {
    id: "f9",
    name: "Competitor Analysis",
    kind: "document",
    mimeType: "application/vnd.google-apps.spreadsheet",
    size: null,
    source: "google-drive",
    url: "#",
    thumbnailUrl: null,
    uploadedBy: "Maria Chen",
    uploadedAt: new Date("2026-06-02T15:00:00"),
    driveId: "1tVJZca6WB2Qi6XXXXX",
  },
  {
    id: "f10",
    name: "avatar-placeholder.webp",
    kind: "image",
    mimeType: "image/webp",
    size: 34_200,
    source: "hosted",
    url: "#",
    thumbnailUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop",
    uploadedBy: "Sarah Kim",
    uploadedAt: new Date("2026-06-01T12:10:00"),
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function getKindConfig(kind: FileKind, source: FileSource) {
  if (source === "google-drive") {
    return {
      icon: HardDrive,
      label: "Drive",
      badgeClass:
        "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400",
      iconClass: "text-green-600 dark:text-green-400",
    }
  }
  switch (kind) {
    case "image":
      return {
        icon: FileImage,
        label: "Image",
        badgeClass:
          "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-400",
        iconClass: "text-sky-500 dark:text-sky-400",
      }
    case "video":
      return {
        icon: FileVideo,
        label: "Video",
        badgeClass:
          "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-400",
        iconClass: "text-violet-500 dark:text-violet-400",
      }
    case "document":
      return {
        icon: FileText,
        label: "Doc",
        badgeClass:
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
        iconClass: "text-amber-500 dark:text-amber-400",
      }
    default:
      return {
        icon: File,
        label: "File",
        badgeClass: "border-border bg-muted text-muted-foreground",
        iconClass: "text-muted-foreground",
      }
  }
}

// ─── Sort header ──────────────────────────────────────────────────────────────

function SortHeader({
  column,
  children,
}: {
  column: {
    getIsSorted: () => false | "asc" | "desc"
    toggleSorting: (asc?: boolean) => void
  }
  children: React.ReactNode
}) {
  const sorted = column.getIsSorted()
  return (
    <button
      onClick={() => column.toggleSorting(sorted === "asc")}
      className="group inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
      <span className="ml-0.5 opacity-40 transition-opacity group-hover:opacity-100">
        {sorted === "asc" ? (
          <ChevronUp className="size-3.5" />
        ) : sorted === "desc" ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ArrowUpDown className="size-3" />
        )}
      </span>
    </button>
  )
}

// ─── Column definitions ────────────────────────────────────────────────────────

const columns: Array<ColumnDef<ProjectFile>> = [
  {
    accessorKey: "name",
    header: ({ column }) => <SortHeader column={column}>Name</SortHeader>,
    cell: ({ row }) => {
      const file = row.original
      const cfg = getKindConfig(file.kind, file.source)
      const Icon = cfg.icon
      return (
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border",
              file.thumbnailUrl
                ? "border-border/60 bg-muted/40"
                : "border-border/40 bg-muted/60",
            )}
          >
            {file.thumbnailUrl ? (
              <img
                src={file.thumbnailUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <Icon className={cn("size-4", cfg.iconClass)} />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium leading-none text-foreground">
              {file.name}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/60">
              {file.mimeType}
            </span>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "kind",
    header: () => (
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Type
      </span>
    ),
    cell: ({ row }) => {
      const file = row.original
      const cfg = getKindConfig(file.kind, file.source)
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
            cfg.badgeClass,
          )}
        >
          {file.source === "google-drive" && <HardDrive className="size-3" />}
          {cfg.label}
        </span>
      )
    },
  },
  {
    accessorKey: "size",
    header: ({ column }) => <SortHeader column={column}>Size</SortHeader>,
    cell: ({ row }) => {
      const size = row.original.size
      if (size === null)
        return (
          <span className="text-xs italic text-muted-foreground/50">—</span>
        )
      return (
        <span className="font-mono text-xs text-muted-foreground">
          {formatBytes(size)}
        </span>
      )
    },
    sortingFn: (a, b) => {
      const sizeA = a.original.size ?? -1
      const sizeB = b.original.size ?? -1
      return sizeA - sizeB
    },
  },
  {
    accessorKey: "uploadedBy",
    header: () => (
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Uploaded by
      </span>
    ),
    cell: ({ row }) => {
      const name = row.original.uploadedBy
      const initials = name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
      return (
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
            {initials}
          </span>
          <span className="text-sm text-muted-foreground">{name}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "uploadedAt",
    header: ({ column }) => <SortHeader column={column}>Date</SortHeader>,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.uploadedAt)}
      </span>
    ),
    sortingFn: (a, b) =>
      a.original.uploadedAt.getTime() - b.original.uploadedAt.getTime(),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const file = row.original
      return (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="size-7 p-0 opacity-0 transition-opacity group-hover/row:opacity-100"
            title="Preview"
          >
            <Eye className="size-3.5 text-muted-foreground" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="size-7 p-0 opacity-0 transition-opacity group-hover/row:opacity-100"
              >
                <MoreHorizontal className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem className="gap-2 text-sm">
                <Eye className="size-3.5" /> Preview
              </DropdownMenuItem>
              {file.source === "hosted" ? (
                <DropdownMenuItem className="gap-2 text-sm">
                  <Download className="size-3.5" /> Download
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem className="gap-2 text-sm">
                  <Link2 className="size-3.5" /> Open in Drive
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="gap-2 text-sm">
                <Link2 className="size-3.5" /> Copy link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-sm text-destructive focus:text-destructive">
                <Trash2 className="size-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
  },
]

// ─── Page component ────────────────────────────────────────────────────────────

type KindFilter = "all" | "image" | "video" | "document" | "other" | "google-drive"

const KIND_FILTERS: Array<{ value: KindFilter; label: string }> = [
  { value: "all", label: "All files" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
  { value: "document", label: "Docs" },
  { value: "google-drive", label: "Google Drive" },
]

function FilesPage() {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "uploadedAt", desc: true },
  ])
  const [globalSearch, setGlobalSearch] = useState("")
  const [activeKind, setActiveKind] = useState<KindFilter>("all")

  const filteredData = useMemo(() => {
    return MOCK_FILES.filter((file) => {
      const matchesSearch =
        !globalSearch ||
        file.name.toLowerCase().includes(globalSearch.toLowerCase()) ||
        file.uploadedBy.toLowerCase().includes(globalSearch.toLowerCase())

      const matchesKind =
        activeKind === "all" ||
        (activeKind === "google-drive"
          ? file.source === "google-drive"
          : file.kind === activeKind)

      return matchesSearch && matchesKind
    })
  }, [globalSearch, activeKind])

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="flex flex-1 flex-col">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="border-b bg-muted/50">
        <div className="container py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold md:text-3xl">Files</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload images, videos, and documents — or link files from Google Drive.
              </p>
            </div>
            <Button size="default" className="shrink-0 gap-2">
              <Upload className="size-4" />
              Upload
            </Button>
          </div>
        </div>
      </div>

      {/* ── Table area ──────────────────────────────────────────────── */}
      <div className="container flex flex-1 flex-col gap-4 py-6">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative max-w-72 flex-1">
            <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search files or people…"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="h-8 pl-8 pr-8 text-sm"
            />
            {globalSearch && (
              <button
                onClick={() => setGlobalSearch("")}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground/60 transition-colors hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Kind pill filters */}
          <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-0.5">
            {KIND_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setActiveKind(f.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                  activeKind === f.value
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.value === "google-drive" && <HardDrive className="size-3" />}
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
          <table className="w-full border-collapse text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="border-b border-border/50 bg-muted/40"
                >
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left first:pl-5 last:pr-5"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="py-16 text-center text-sm text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-xl border border-dashed border-border bg-muted/50">
                        <Search className="size-5 text-muted-foreground/50" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          No files found
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Try a different search or filter.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "group/row transition-colors",
                      "hover:bg-muted/40 dark:hover:bg-muted/20",
                      i !== table.getRowModel().rows.length - 1 &&
                        "border-b border-border/40",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-3 align-middle first:pl-5 last:pr-5"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Footer */}
          {table.getRowModel().rows.length > 0 && (
            <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-5 py-2.5">
              <p className="font-mono text-[11px] text-muted-foreground/70">
                Showing{" "}
                <span className="font-semibold text-foreground">
                  {table.getRowModel().rows.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-foreground">
                  {MOCK_FILES.length}
                </span>{" "}
                files
              </p>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
                <Filter className="size-3" />
                <span>
                  {activeKind !== "all"
                    ? KIND_FILTERS.find((f) => f.value === activeKind)?.label
                    : "No filter"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Google Drive callout */}
        <div className="flex items-start gap-3 rounded-xl border border-green-200/60 bg-green-50/50 p-4 dark:border-green-900/40 dark:bg-green-950/20">
          <HardDrive className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-green-900 dark:text-green-300">
              Google Drive integration is in research
            </p>
            <p className="text-xs leading-relaxed text-green-700/80 dark:text-green-400/80">
              We&apos;re exploring support for linking Google Drive files (Docs, Sheets, Slides,
              folders) directly into Kino projects. Drive files don&apos;t count toward your storage
              quota.
            </p>
          </div>
          <Badge
            variant="outline"
            className="ml-auto shrink-0 border-green-300 bg-green-100/50 text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-400"
          >
            Coming soon
          </Badge>
        </div>
      </div>
    </div>
  )
}
