import { Link } from "@tanstack/react-router"
import { Archive, ExternalLink, Globe, Lock, Settings } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatRelativeDay } from "@/lib/utils/format-timestamp"

type Visibility = "public" | "private" | "archived"

interface ProjectHeaderData {
  name: string
  description?: string | null
  visibility: Visibility
  logoUrl?: string | null
  urls?: Array<{ url: string; text: string }> | null
  updatedTime?: number | null
  createdAt?: number
}

const VISIBILITY_CONFIG: Record<
  Visibility,
  { label: string; Icon: typeof Globe; className: string }
> = {
  public: {
    label: "Public",
    Icon: Globe,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
  private: {
    label: "Private",
    Icon: Lock,
    className:
      "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-500/10 dark:text-amber-400",
  },
  archived: {
    label: "Archived",
    Icon: Archive,
    className: "border-border bg-muted text-muted-foreground",
  },
}

export function OverviewHeader({
  project,
  params,
  canEdit,
}: {
  project: ProjectHeaderData
  params: { org: string; project: string }
  canEdit: boolean
}) {
  const visibility = VISIBILITY_CONFIG[project.visibility]
  const VisibilityIcon = visibility.Icon
  const primaryUrl = project.urls?.[0]
  const updatedAt = project.updatedTime ?? project.createdAt

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        {/* Logo / monogram */}
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted text-lg font-semibold text-muted-foreground">
          {project.logoUrl ? (
            <img
              src={project.logoUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            project.name.charAt(0).toUpperCase()
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold md:text-3xl">{project.name}</h1>
            <Badge
              variant="outline"
              className={cn("gap-1 font-normal", visibility.className)}
            >
              <VisibilityIcon className="size-3" />
              {visibility.label}
            </Badge>
          </div>

          {project.description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {project.description}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {updatedAt ? (
              <span>Updated {formatRelativeDay(updatedAt)}</span>
            ) : null}
            {primaryUrl && (
              <a
                href={primaryUrl.url}
                target="_blank"
                rel="noreferrer"
                className="link-text inline-flex items-center gap-1"
              >
                <ExternalLink className="size-3" />
                {primaryUrl.text || primaryUrl.url}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {canEdit && (
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link
              to="/@{$org}/$project/settings"
              params={(prev) => ({ ...prev, ...params })}
            >
              <Settings className="size-4" />
              Settings
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
