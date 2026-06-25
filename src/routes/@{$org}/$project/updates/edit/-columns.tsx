import { createColumnHelper } from "@tanstack/react-table"
import { Link } from "@tanstack/react-router"
import { ChevronRight } from "lucide-react"

import type { DashboardUpdate } from "./-types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { formatFullDate, formatTimestamp } from "@/lib/utils/format-timestamp"

import { CategoryBadge } from "../-components/category-badge"
import { StatusBadge } from "../-components/status-badge"

const columnHelper = createColumnHelper<DashboardUpdate>()

/**
 * Builds the dashboard table columns. Kept as a factory because the title and
 * actions cells close over the route params (for links) and the sheet opener.
 */
export function createUpdateColumns(
  params: { org: string; project: string },
  onOpenSheet: (id: string) => void
) {
  return [
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
      meta: {
        headerClassName: "hidden lg:table-cell",
        cellClassName: "hidden lg:table-cell",
      },
    }),
    columnHelper.accessor("category", {
      cell: ({ getValue }) => <CategoryBadge category={getValue()} />,
      header: "Category",
      meta: {
        headerClassName: "hidden md:table-cell",
        cellClassName: "hidden md:table-cell",
      },
    }),
    columnHelper.accessor("status", {
      cell: ({ getValue }) => <StatusBadge status={getValue()} />,
      header: "Status",
      meta: {
        headerClassName: "hidden sm:table-cell",
        cellClassName: "hidden sm:table-cell",
      },
    }),
    columnHelper.display({
      cell: ({ row }) => {
        const timestamp = row.original.updatedTime ?? row.original.createdAt
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
      meta: {
        headerClassName: "hidden lg:table-cell",
        cellClassName: "hidden lg:table-cell",
      },
    }),
    columnHelper.display({
      cell: ({ row }) => (
        <Button
          className="gap-1.5 text-muted-foreground"
          onClick={() => onOpenSheet(row.original.id)}
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
  ]
}
