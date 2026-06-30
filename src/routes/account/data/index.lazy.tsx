import { useMemo, useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Navigate,
  createLazyFileRoute,
  useRouterState,
} from "@tanstack/react-router"
import type { ApiOutputs } from "@convex/api"
import { Check, Database, Download } from "lucide-react"

import { InlineAlert } from "@/components/inline-alert"
import { Label, LabelDescription, LabelWrapper } from "@/components/label"
import { Button } from "@/components/ui/button"
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc"
import { cn } from "@/lib/utils"
import { capturePostHogEvent } from "@/lib/posthog"

type ExportSection =
  ApiOutputs["userDataExport"]["getAvailableSections"][number]
type ExportSectionId = ExportSection["id"]
type ExportDocument = ApiOutputs["userDataExport"]["exportData"]

export const Route = createLazyFileRoute("/account/data/")({
  component: DataRoute,
})

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "data" in error) {
    const data = (error as { data?: { message?: unknown } }).data
    if (typeof data?.message === "string") return data.message
  }

  if (error instanceof Error) return error.message

  return "Unable to export your data"
}

function getExportFailureReason(error: unknown) {
  const message = getErrorMessage(error).toLowerCase()

  if (message.includes("too large")) return "too_large"
  if (message.includes("not authenticated") || message.includes("unauthorized")) {
    return "unauthorized"
  }

  return "unknown"
}

function getCountBucket(count: number) {
  if (count === 0) return "0"
  if (count <= 10) return "1-10"
  if (count <= 100) return "11-100"
  return "101+"
}

function getExportAnalyticsProperties(
  exportDocument: ExportDocument,
  sectionIds: ExportSectionId[]
) {
  const comments = exportDocument.sections.comments
  const totalComments =
    typeof comments === "object" &&
    comments &&
    "counts" in comments &&
    typeof comments.counts === "object" &&
    comments.counts &&
    "total" in comments.counts &&
    typeof comments.counts.total === "number"
      ? comments.counts.total
      : 0

  return {
    comment_count_bucket: getCountBucket(totalComments),
    export_version: exportDocument.version,
    section_count: sectionIds.length,
    sections: sectionIds,
  }
}

function createExportFilename() {
  const date = new Date().toISOString().slice(0, 10)
  return `kino-user-data-${date}.json`
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function DataRoute() {
  const { loaderToken } = Route.useRouteContext()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  if (!loaderToken) {
    return <Navigate search={{ redirect: pathname }} to="/auth" />
  }

  return <AuthenticatedDataRoute />
}

function AuthenticatedDataRoute() {
  const crpc = useCRPC()
  const crpcClient = useCRPCClient()
  const sectionsQuery = useSuspenseQuery(
    crpc.userDataExport.getAvailableSections.queryOptions(
      {},
      { skipUnauth: true }
    )
  )
  const defaultSectionIds = useMemo(
    () =>
      sectionsQuery.data
        .filter((section) => section.includedByDefault)
        .map((section) => section.id),
    [sectionsQuery.data]
  )
  const [selectedSectionIds, setSelectedSectionIds] = useState<
    ExportSectionId[] | null
  >(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const activeSectionIds = selectedSectionIds ?? defaultSectionIds
  const selectedSectionIdSet = new Set(activeSectionIds)

  const toggleSection = (sectionId: ExportSectionId) => {
    setSelectedSectionIds((current) => {
      const next = new Set(current ?? defaultSectionIds)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return Array.from(next)
    })
  }

  const handleExport = async () => {
    if (activeSectionIds.length === 0) return

    setExportError(null)
    setIsExporting(true)
    try {
      const exportDocument = await crpcClient.userDataExport.exportData.query({
        sections: activeSectionIds,
      })
      capturePostHogEvent(
        "user_data_export_downloaded",
        getExportAnalyticsProperties(exportDocument, activeSectionIds)
      )
      downloadJson(createExportFilename(), exportDocument)
    } catch (error) {
      setExportError(getErrorMessage(error))
      capturePostHogEvent("user_data_export_failed", {
        reason: getExportFailureReason(error),
        section_count: activeSectionIds.length,
        sections: activeSectionIds,
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <header className="border-b pb-4">
        <h2 className="text-xl font-semibold">Data</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Export a JSON copy of the data tied to your Kino account.
        </p>
      </header>

      <div className="rounded-xl border bg-card">
        <div className="flex flex-col gap-6 p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Database className="size-4" />
            </div>
            <LabelWrapper className="mb-0">
              <Label>Export sections</Label>
              <LabelDescription>
                Choose which available sections to include in the download.
              </LabelDescription>
            </LabelWrapper>
          </div>

          <div className="grid gap-3">
            {sectionsQuery.data.map((section) => {
              const isSelected = selectedSectionIdSet.has(section.id)

              return (
                <button
                  key={section.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleSection(section.id)}
                  className={cn(
                    "flex items-start justify-between gap-4 rounded-lg border bg-background p-4 text-left transition-colors hocus:border-foreground/30 hocus:bg-accent/40",
                    isSelected && "border-foreground ring-1 ring-foreground"
                  )}
                >
                  <span className="flex flex-col gap-1">
                    <span className="font-medium">{section.label}</span>
                    <span className="text-sm text-muted-foreground">
                      {section.description}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border text-background",
                      isSelected
                        ? "border-foreground bg-foreground"
                        : "border-border bg-background"
                    )}
                  >
                    {isSelected ? <Check className="size-3.5" /> : null}
                  </span>
                </button>
              )
            })}
          </div>

          {exportError ? (
            <InlineAlert variant="danger">{exportError}</InlineAlert>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            The export downloads immediately as a JSON file.
          </p>
          <Button
            className="sm:self-end"
            disabled={isExporting || activeSectionIds.length === 0}
            onClick={() => void handleExport()}
            type="button"
          >
            <Download data-icon="inline-start" className="size-4" />
            {isExporting ? "Preparing export" : "Download JSON"}
          </Button>
        </div>
      </div>
    </section>
  )
}
