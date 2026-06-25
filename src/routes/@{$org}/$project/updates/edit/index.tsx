import { useEffect, useMemo, useState } from "react"
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type RowSelectionState,
  type VisibilityState,
} from "@tanstack/react-table"
import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  Link,
  Navigate,
  notFound,
  useNavigate,
} from "@tanstack/react-router"
import {
  ChevronRight,
  Columns3,
  ExternalLink,
  Globe,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react"
import { z } from "zod"

import { InlineAlert } from "@/components/inline-alert"
import { RoutePending } from "@/components/route-pending"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useCRPC } from "@/lib/convex/crpc"
import { crpcServer } from "@/lib/convex/crpc-server"
import { cn } from "@/lib/utils"
import { formatFullDate, formatTimestamp } from "@/lib/utils/format-timestamp"

import {
  CategoryBadge,
  type UpdateCategory,
} from "../-components/category-badge"
import { projectTitle, titleMeta } from "@/lib/seo"

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const dashboardSearchParams = z.object({
  pageSize: z
    .coerce.number()
    .pipe(z.union([z.literal(10), z.literal(20), z.literal(50)]))
    .catch(DEFAULT_PAGE_SIZE),
})

type DashboardUpdate = {
  author: {
    id: string
    imageUrl: string | null
    name: string | null
    username: string | null
  } | null
  category: UpdateCategory
  createdAt: number
  id: string
  publishedAt?: number | null
  slug: string
  status: "draft" | "published"
  title: string
  updatedTime?: number | null
}

type DeleteDialogState = {
  ids: string[]
  updates: Array<{ id: string; title: string }>
} | null

type StatusFilter = "all" | "draft" | "published"
const UPDATE_STATUS_ITEMS = [
  { label: <StatusBadge status="draft" />, value: "draft" },
  { label: <StatusBadge status="published" />, value: "published" },
] as const

const COLUMN_LABELS: Record<string, string> = {
  author: "Author",
  category: "Category",
  activity: "Last Activity",
  status: "Status",
}

const columnHelper = createColumnHelper<DashboardUpdate>()

export const Route = createFileRoute("/@{$org}/$project/updates/edit/")({
  component: UpdatesDashboardRoute,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps, params }) => {
    const projectData = await context.queryClient.ensureQueryData(
      crpcServer.project.getDetails.queryOptions({
        orgSlug: params.org,
        slug: params.project,
      })
    )

    if (!projectData?.project) {
      throw notFound()
    }

    if (!projectData.permissions.canEdit) {
      return
    }

    await context.queryClient.ensureQueryData(
      crpcServer.update.listProjectDashboard.queryOptions({
        cursor: null,
        limit: deps.pageSize,
        projectId: projectData.project.id,
      })
    )
  },
  pendingComponent: () => <RoutePending variant="page" />,
  pendingMs: 600,
  validateSearch: dashboardSearchParams,
  head: ({ params }) => ({
    meta: [titleMeta(["Manage Updates", projectTitle(params.org, params.project)])],
  }),
})

function UpdatesDashboardRoute() {
  const params = Route.useParams()
  const { pageSize } = Route.useSearch()
  const crpc = useCRPC()
  const { data: projectData } = useSuspenseQuery(
    crpc.project.getDetails.queryOptions({
      orgSlug: params.org,
      slug: params.project,
    })
  )

  if (!projectData?.project) {
    throw notFound()
  }

  if (!projectData.permissions.canEdit) {
    return (
      <Navigate
        params={{ org: params.org, project: params.project }}
        to="/@{$org}/$project/updates"
      />
    )
  }

  return (
    <UpdatesDashboard
      canDelete={projectData.permissions.canDelete}
      pageSize={pageSize}
    />
  )
}

function UpdatesDashboard({
  canDelete,
  pageSize,
}: {
  canDelete: boolean
  pageSize: number
}) {
  const params = Route.useParams()
  const navigate = useNavigate()
  const crpc = useCRPC()
  const { data: projectData } = useSuspenseQuery(
    crpc.project.getDetails.queryOptions({
      orgSlug: params.org,
      slug: params.project,
    })
  )

  const projectId = projectData?.project?.id
  if (!projectId) {
    throw notFound()
  }

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize,
  })
  const [cursorByPage, setCursorByPage] = useState<
    Record<number, string | null>
  >({ 0: null })
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(null)
  const [actionError, setActionError] = useState("")
  const [sheetUpdateId, setSheetUpdateId] = useState<string | null>(null)

  useEffect(() => {
    setPagination({ pageIndex: 0, pageSize })
    setCursorByPage({ 0: null })
  }, [pageSize])

  // Clear row selection whenever the visible page or status filter changes —
  // selections are page/filter specific, so they shouldn't carry over.
  useEffect(() => {
    setRowSelection({})
  }, [pagination.pageIndex, pagination.pageSize, statusFilter])

  const currentCursor = cursorByPage[pagination.pageIndex] ?? null
  const dashboardQuery = useSuspenseQuery(
    crpc.update.listProjectDashboard.queryOptions({
      cursor: currentCursor,
      limit: pagination.pageSize,
      projectId,
    })
  )

  const publishMutation = useMutation(
    crpc.update.bulkPublish.mutationOptions({
      onError: (error) => setActionError(error.message),
      onSuccess: () => {
        setActionError("")
        setRowSelection({})
      },
    })
  )
  const unpublishMutation = useMutation(
    crpc.update.bulkUnpublish.mutationOptions({
      onError: (error) => setActionError(error.message),
      onSuccess: () => {
        setActionError("")
        setRowSelection({})
      },
    })
  )
  const deleteMutation = useMutation(
    crpc.update.bulkRemove.mutationOptions({
      onError: (error) => setActionError(error.message),
      onSuccess: () => {
        setActionError("")
        setDeleteDialog(null)
        setRowSelection({})
      },
    })
  )

  const allRows = dashboardQuery.data.page

  // Derive sheet data from live query — stays reactive when Convex pushes updates
  const sheetUpdate = useMemo(
    () =>
      sheetUpdateId
        ? allRows.find((row) => row.id === sheetUpdateId) ?? null
        : null,
    [allRows, sheetUpdateId]
  )

  const rows = useMemo(
    () =>
      statusFilter === "all"
        ? allRows
        : allRows.filter((row) => row.status === statusFilter),
    [allRows, statusFilter]
  )

  const selectedIds = useMemo(
    () =>
      Object.entries(rowSelection)
        .filter(([, selected]) => selected)
        .map(([id]) => id),
    [rowSelection]
  )
  const selectedCount = selectedIds.length

  useEffect(() => {
    if (allRows.length === 0 && pagination.pageIndex > 0) {
      setPagination((current) => ({
        ...current,
        pageIndex: current.pageIndex - 1,
      }))
    }
  }, [pagination.pageIndex, allRows.length])

  const columns = useMemo(
    () => [
      columnHelper.display({
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.title}`}
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked === true)}
          />
        ),
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all rows on this page"
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(checked) =>
              table.toggleAllPageRowsSelected(checked === true)
            }
          />
        ),
        id: "select",
        size: 40,
        enableHiding: false,
      }),
      columnHelper.accessor("title", {
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col gap-0.5">
            <Link
              className="truncate font-medium hover:underline"
              params={{
                org: params.org,
                project: params.project,
                slug: row.original.slug,
              }}
              to="/@{$org}/$project/updates/$slug"
            >
              {row.original.title}
            </Link>
            <span className="truncate text-xs text-muted-foreground">
              {row.original.slug}
            </span>
          </div>
        ),
        header: "Title",
        enableHiding: false,
      }),
      columnHelper.display({
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.author?.name ??
              row.original.author?.username ??
              "Unknown"}
          </span>
        ),
        header: "Author",
        id: "author",
        meta: { headerClassName: "hidden lg:table-cell", cellClassName: "hidden lg:table-cell" },
      }),
      columnHelper.accessor("category", {
        cell: ({ getValue }) => <CategoryBadge category={getValue()} />,
        header: "Category",
        meta: { headerClassName: "hidden md:table-cell", cellClassName: "hidden md:table-cell" },
      }),
      columnHelper.accessor("status", {
        cell: ({ getValue }) => <StatusBadge status={getValue()} />,
        header: "Status",
        meta: { headerClassName: "hidden sm:table-cell", cellClassName: "hidden sm:table-cell" },
      }),
      columnHelper.display({
        cell: ({ row }) => {
          const timestamp =
            row.original.updatedTime ?? row.original.createdAt
          const label =
            row.original.status === "published" ? "Published" : "Updated"
          return (
            <div className="flex min-w-0 flex-col gap-0.5 text-sm">
              <span>{formatTimestamp(timestamp, { relative: false })}</span>
              <span
                className="text-xs text-muted-foreground"
                title={formatFullDate(timestamp)}
              >
                {label} {formatTimestamp(timestamp)}
              </span>
            </div>
          )
        },
        header: "Last Activity",
        id: "activity",
        meta: { headerClassName: "hidden lg:table-cell", cellClassName: "hidden lg:table-cell" },
      }),
      columnHelper.display({
        cell: ({ row }) => (
          <Button
            className="gap-1.5 text-muted-foreground"
            onClick={() => setSheetUpdateId(row.original.id)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Options
            <ChevronRight className="size-3.5" />
          </Button>
        ),
        header: () => <span className="sr-only">Actions</span>,
        id: "actions",
        size: 100,
        enableHiding: false,
      }),
    ],
    [params.org, params.project]
  )

  const table = useReactTable({
    columns,
    data: rows,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualPagination: true,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    pageCount: dashboardQuery.data.isDone
      ? pagination.pageIndex + 1
      : pagination.pageIndex + 2,
    state: {
      pagination,
      rowSelection,
      columnVisibility,
    },
  })

  const toggleableColumns = table
    .getAllColumns()
    .filter((col) => col.getCanHide())

  function handlePageSizeChange(nextPageSize: number) {
    void navigate({
      params: { org: params.org, project: params.project },
      search: {
        pageSize: String(nextPageSize) as "10" | "20" | "50",
      },
      to: Route.to,
    })
  }

  function handleNextPage() {
    if (dashboardQuery.data.isDone || !dashboardQuery.data.continueCursor)
      return

    setCursorByPage((current) => ({
      ...current,
      [pagination.pageIndex + 1]: dashboardQuery.data.continueCursor,
    }))
    setPagination((current) => ({
      ...current,
      pageIndex: current.pageIndex + 1,
    }))
  }

  function handlePreviousPage() {
    if (pagination.pageIndex === 0) return

    setPagination((current) => ({
      ...current,
      pageIndex: current.pageIndex - 1,
    }))
  }

  function handleBulkPublish() {
    if (selectedCount === 0) return
    setActionError("")
    publishMutation.mutate({ ids: selectedIds, projectId })
  }

  function handleBulkUnpublish() {
    if (selectedCount === 0) return
    setActionError("")
    unpublishMutation.mutate({ ids: selectedIds, projectId })
  }

  function handleConfirmDelete() {
    if (!deleteDialog) return
    setActionError("")
    deleteMutation.mutate({ ids: deleteDialog.ids, projectId })
  }

  const pendingAction =
    publishMutation.isPending ||
    unpublishMutation.isPending ||
    deleteMutation.isPending

  // Status filter counts
  const draftCount = allRows.filter((r) => r.status === "draft").length
  const publishedCount = allRows.filter((r) => r.status === "published").length

  return (
    <>
      {/* Delete confirmation dialog */}
      <Dialog
        onOpenChange={(open) => !open && setDeleteDialog(null)}
        open={deleteDialog !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete update{deleteDialog?.ids.length === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone.
              {deleteDialog && deleteDialog.updates.length > 0
                ? " These posts will be removed:"
                : null}
            </DialogDescription>
          </DialogHeader>
          {deleteDialog ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <ul className="space-y-1">
                {deleteDialog.updates.map((update) => (
                  <li key={update.id} className="truncate">
                    {update.title}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              onClick={() => setDeleteDialog(null)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={deleteMutation.isPending}
              onClick={handleConfirmDelete}
              type="button"
              variant="destructive"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Row action sheet */}
      <Sheet
        onOpenChange={(open) => !open && setSheetUpdateId(null)}
        open={sheetUpdateId !== null && sheetUpdate !== null}
      >
        <SheetContent side="right">
          {sheetUpdate ? (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <Settings2 className="size-3.5" />
                  Update Options
                </div>
                <SheetTitle className="pr-6 text-lg leading-snug">
                  {sheetUpdate.title}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Options for {sheetUpdate.title}
                </SheetDescription>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={sheetUpdate.status} />
                    <CategoryBadge category={sheetUpdate.category} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {sheetUpdate.author?.name ??
                      sheetUpdate.author?.username ??
                      "Unknown"}
                    {" · "}
                    {sheetUpdate.status === "published" &&
                    sheetUpdate.publishedAt
                      ? `Published ${formatFullDate(sheetUpdate.publishedAt)}`
                      : `Updated ${formatFullDate(sheetUpdate.updatedTime ?? sheetUpdate.createdAt)}`}
                  </div>
                </div>
              </SheetHeader>

              <div className="flex flex-1 flex-col px-4">
                <Separator className="mb-4" />

                {/* Links */}
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
                    Links
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <Link
                      className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setSheetUpdateId(null)}
                      params={{
                        org: params.org,
                        project: params.project,
                        slug: sheetUpdate.slug,
                      }}
                      to="/@{$org}/$project/updates/$slug"
                    >
                      <ExternalLink className="size-3.5" />
                      View update
                    </Link>
                    <Link
                      className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setSheetUpdateId(null)}
                      params={{
                        org: params.org,
                        project: params.project,
                        slug: sheetUpdate.slug,
                      }}
                      to="/@{$org}/$project/updates/$slug/edit"
                    >
                      <Pencil className="size-3.5" />
                      Edit update
                    </Link>
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Status */}
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
                    Status
                  </p>
                  <Select
                    items={UPDATE_STATUS_ITEMS}
                    onValueChange={(value) => {
                      setActionError("")
                      if (
                        value === "published" &&
                        sheetUpdate.status === "draft"
                      ) {
                        publishMutation.mutate({
                          ids: [sheetUpdate.id],
                          projectId,
                        })
                      } else if (
                        value === "draft" &&
                        sheetUpdate.status === "published"
                      ) {
                        unpublishMutation.mutate({
                          ids: [sheetUpdate.id],
                          projectId,
                        })
                      }
                    }}
                    value={sheetUpdate.status}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">
                        <StatusBadge status="draft" />
                      </SelectItem>
                      <SelectItem value="published">
                        <StatusBadge status="published" />
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Delete — pinned to bottom */}
              {canDelete ? (
                <div className="mt-auto border-t px-4 py-4">
                  <Button
                    className="w-full justify-start gap-2.5 text-destructive hover:text-destructive"
                    onClick={() => {
                      setSheetUpdateId(null)
                      setDeleteDialog({
                        ids: [sheetUpdate.id],
                        updates: [{ id: sheetUpdate.id, title: sheetUpdate.title }],
                      })
                    }}
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="size-4" />
                    Delete Update
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Page content — single column */}
      <div className="container flex flex-1 flex-col py-6 md:py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 pb-4 md:gap-6 md:pb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold md:text-3xl">
                Manage Updates
              </h1>
              <p className="text-sm text-muted-foreground">
                Drafting, publishing, and reviewing project updates.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link
                  params={{ org: params.org, project: params.project }}
                  to="/@{$org}/$project/updates"
                >
                  <Globe className="size-3.5" />
                  <span className="hidden sm:inline">Public Feed</span>
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link
                  params={{ org: params.org, project: params.project }}
                  to="/@{$org}/$project/updates/new"
                >
                  <Plus className="size-3.5" />
                  New Update
                </Link>
              </Button>
            </div>
          </div>

          {/* Toolbar — row 1: status filter + controls */}
          <div className="flex flex-col gap-3 border-t pt-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Status filter tabs */}
              <div className="flex items-center rounded-md border bg-muted/40 p-0.5">
                <button
                  className={cn(
                    "rounded-sm px-2 py-1 text-xs font-medium transition-colors sm:px-2.5",
                    statusFilter === "all"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setStatusFilter("all")}
                  type="button"
                >
                  All{" "}
                  <span className="ml-0.5 text-muted-foreground sm:ml-1">
                    {allRows.length}
                  </span>
                </button>
                <button
                  className={cn(
                    "rounded-sm px-2 py-1 text-xs font-medium transition-colors sm:px-2.5",
                    statusFilter === "published"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setStatusFilter("published")}
                  type="button"
                >
                  Published{" "}
                  <span className="ml-0.5 text-muted-foreground sm:ml-1">
                    {publishedCount}
                  </span>
                </button>
                <button
                  className={cn(
                    "rounded-sm px-2 py-1 text-xs font-medium transition-colors sm:px-2.5",
                    statusFilter === "draft"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setStatusFilter("draft")}
                  type="button"
                >
                  Draft{" "}
                  <span className="ml-0.5 text-muted-foreground sm:ml-1">
                    {draftCount}
                  </span>
                </button>
              </div>

              <Separator
                className="hidden h-4 sm:block"
                orientation="vertical"
              />

              {/* Column visibility toggle */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Columns3 className="size-3.5" />
                    <span className="hidden sm:inline">Columns</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-48 p-2">
                  <div className="flex flex-col gap-0.5">
                    {toggleableColumns.map((column) => (
                      <label
                        key={column.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={column.getIsVisible()}
                          onCheckedChange={(checked) =>
                            column.toggleVisibility(checked === true)
                          }
                        />
                        {COLUMN_LABELS[column.id] ?? column.id}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Rows per page */}
              <div className="ml-auto flex items-center gap-1.5">
                <label
                  className="text-xs text-muted-foreground"
                  htmlFor="updates-page-size"
                >
                  Rows
                </label>
                <select
                  className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                  id="updates-page-size"
                  onChange={(event) =>
                    handlePageSizeChange(Number(event.target.value))
                  }
                  value={pagination.pageSize}
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Toolbar — row 2: bulk actions (only when selected) */}
            {selectedCount > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{selectedCount} selected</Badge>
                <Button
                  disabled={pendingAction}
                  onClick={handleBulkPublish}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Publish
                </Button>
                <Button
                  disabled={pendingAction}
                  onClick={handleBulkUnpublish}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Unpublish
                </Button>
                {canDelete ? (
                  <Button
                    disabled={pendingAction}
                    onClick={() => {
                      const selectedUpdates = rows
                        .filter((row) => selectedIds.includes(row.id))
                        .map((row) => ({ id: row.id, title: row.title }))
                      setDeleteDialog({
                        ids: selectedIds,
                        updates: selectedUpdates,
                      })
                    }}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {actionError ? (
          <div className="pb-4">
            <InlineAlert variant="warning">{actionError}</InlineAlert>
          </div>
        ) : null}

        {/* Table */}
        {rows.length === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-10 text-center text-muted-foreground">
            {statusFilter !== "all"
              ? `No ${statusFilter} updates on this page.`
              : "No updates yet."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        const meta = header.column.columnDef.meta as
                          | { headerClassName?: string }
                          | undefined
                        return (
                          <th
                            key={header.id}
                            className={cn(
                              "whitespace-nowrap px-3 py-2.5 font-medium sm:px-4",
                              meta?.headerClassName
                            )}
                            style={
                              header.column.getSize() !== 150
                                ? { width: header.column.getSize() }
                                : undefined
                            }
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </th>
                        )
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t transition-colors hover:bg-muted/20 data-[state=selected]:bg-muted/30"
                      data-state={
                        row.getIsSelected() ? "selected" : undefined
                      }
                    >
                      {row.getVisibleCells().map((cell) => {
                        const meta = cell.column.columnDef.meta as
                          | { cellClassName?: string }
                          | undefined
                        return (
                          <td
                            key={cell.id}
                            className={cn(
                              "px-3 py-3 align-middle sm:px-4",
                              meta?.cellClassName
                            )}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between gap-2 pt-4">
          <Button
            disabled={!table.getCanPreviousPage()}
            onClick={handlePreviousPage}
            size="sm"
            type="button"
            variant="outline"
          >
            Previous
          </Button>
          <div className="text-center text-xs text-muted-foreground sm:text-sm">
            Page {pagination.pageIndex + 1} · {rows.length} update
            {rows.length === 1 ? "" : "s"}
          </div>
          <Button
            disabled={!table.getCanNextPage()}
            onClick={handleNextPage}
            size="sm"
            type="button"
          >
            Next
          </Button>
        </div>
      </div>
    </>
  )
}

function StatusBadge({ status }: { status: DashboardUpdate["status"] }) {
  if (status === "published") {
    return (
      <Badge
        className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
        variant="outline"
      >
        Published
      </Badge>
    )
  }

  return (
    <Badge
      className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      variant="outline"
    >
      Draft
    </Badge>
  )
}
