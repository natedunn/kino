import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

import { buttonVariants } from "@/components/ui/button"
import { FORM_LIMITS, normalizeSlugInput } from "@/lib/validation"
import { cn } from "@/lib/utils"

export const inputClassName =
  "w-full rounded-xl border border-border bg-background/80 px-3 py-2.5 text-sm outline-none transition focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-foreground/10"

export const textareaClassName =
  "min-h-28 w-full rounded-xl border border-border bg-background/80 px-3 py-2.5 text-sm outline-none transition focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-foreground/10"

export const selectClassName =
  "w-full rounded-xl border border-border bg-background/80 px-3 py-2.5 text-sm outline-none transition focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-foreground/10"

export function PageFrame({
  children,
  sidebar,
}: {
  children: ReactNode
  sidebar?: ReactNode
}) {
  return (
    <main className="mx-auto flex min-h-[calc(100svh-8rem)] w-full max-w-7xl flex-col gap-8 px-4 py-6 md:px-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="min-w-0">{children}</section>
        {sidebar ? (
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            {sidebar}
          </aside>
        ) : null}
      </div>
    </main>
  )
}

export function Panel({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-[1.5rem] border border-border/70 bg-card/90 p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur",
        className
      )}
    >
      {children}
    </div>
  )
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[1.75rem] border border-border/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.03),rgba(14,165,233,0.06),rgba(250,250,249,0.85))] p-6 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        {eyebrow ? (
          <p className="font-mono text-[11px] tracking-[0.24em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <Panel className="border-dashed bg-muted/25 py-10 text-center">
      <div className="mx-auto max-w-xl space-y-2">
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </Panel>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  )
}

export function StatPill({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
      <div className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  )
}

export function StatusBadge({
  kind,
  value,
}: {
  kind: "feedback" | "update" | "category"
  value: string | null | undefined
}) {
  if (!value) return null

  const tone =
    kind === "feedback"
      ? ({
          open: "bg-sky-100 text-sky-800",
          "in-progress": "bg-amber-100 text-amber-800",
          paused: "bg-stone-200 text-stone-800",
          completed: "bg-emerald-100 text-emerald-800",
          closed: "bg-slate-200 text-slate-700",
        }[value] ?? "bg-muted text-foreground")
      : kind === "update"
        ? value === "published"
          ? "bg-emerald-100 text-emerald-800"
          : "bg-amber-100 text-amber-800"
        : ({
            changelog: "bg-sky-100 text-sky-800",
            article: "bg-violet-100 text-violet-800",
            announcement: "bg-rose-100 text-rose-800",
          }[value] ?? "bg-muted text-foreground")

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize",
        tone
      )}
    >
      {value.replaceAll("-", " ")}
    </span>
  )
}

export function formatDate(value: number | string | Date | null | undefined) {
  if (!value) return "Unknown date"
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export function summarizeText(value: string, max = 180) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}…`
}

export function slugify(value: string, max = FORM_LIMITS.projectSlug) {
  return normalizeSlugInput(value, max)
}

export function parseCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export function ProjectTabs({
  orgSlug,
  projectSlug,
}: {
  orgSlug: string
  projectSlug: string
}) {
  const tabClassName =
    "rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground [&.active]:bg-foreground [&.active]:text-background"

  return (
    <nav className="flex flex-wrap gap-2">
      <Link
        activeOptions={{ exact: false }}
        className={tabClassName}
        params={{ org: orgSlug, project: projectSlug }}
        to="/@{$org}/$project/feedback"
      >
        Feedback
      </Link>
      <Link
        activeOptions={{ exact: false }}
        className={tabClassName}
        params={{ org: orgSlug, project: projectSlug }}
        to="/@{$org}/$project/updates"
      >
        Updates
      </Link>
    </nav>
  )
}

export function PrimaryLinkButton({
  children,
  params,
  to,
}: {
  children: ReactNode
  params?: Record<string, string>
  to: string
}) {
  return (
    <Link
      className={buttonVariants({ size: "lg" })}
      params={params as never}
      to={to as never}
    >
      {children}
    </Link>
  )
}
