import { useEffect } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate, useRouterState, useSearch } from "@tanstack/react-router"

import { useCRPC } from "@/lib/convex/crpc"

const STORAGE_KEY = "kino:settings-org"

const SETTINGS_ROUTE = "/org/settings" as const

function readStoredOrg() {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredOrg(slug: string) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, slug)
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

/** Persist the active settings org (e.g. after a slug rename). */
export function persistSettingsOrg(slug: string) {
  writeStoredOrg(slug)
}

/** Loads the orgs the signed-in user can edit (owner/admin/editor). */
export function useEditableOrgs() {
  const crpc = useCRPC()
  return useSuspenseQuery(
    crpc.org.findMyEditableOrgs.queryOptions({}, { skipUnauth: true })
  )
}

/**
 * Resolves the active org for the settings area and keeps the URL `?org=` +
 * `localStorage` in sync. Resolution order: a valid `?org=` slug, then the last
 * stored slug, then the first editable org. Intended for the settings shell.
 */
export function useSettingsOrgController() {
  const navigate = useNavigate()
  const { data: orgs } = useEditableOrgs()
  const search = useSearch({ strict: false }) as { org?: string }
  const searchOrg = search.org
  // Navigate against the current path explicitly — relative `to: "."` from an
  // unbound `useNavigate()` can resolve from the root and silently no-op.
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const has = (slug?: string | null) =>
    !!slug && orgs.some((org) => org.slug === slug)

  // SSR-stable: render purely from the URL (falling back to the first org) so
  // the server and the first client paint agree. `localStorage` is a client-only
  // concern, applied after mount via navigation below — never during render.
  const urlSlug = has(searchOrg) ? searchOrg! : null
  const activeSlug = urlSlug ?? (orgs[0]?.slug ?? null)

  useEffect(() => {
    if (urlSlug) {
      // URL already points at a valid org — remember it for next time.
      writeStoredOrg(urlSlug)
      return
    }
    // No (valid) `?org=` yet: prefer the last stored org, else the first one,
    // and push it into the URL so the pages can read it.
    const stored = readStoredOrg()
    const target = has(stored) ? stored! : (orgs[0]?.slug ?? null)
    if (target && target !== searchOrg) {
      void navigate({
        replace: true,
        search: (prev) => ({ ...prev, org: target }),
        to: pathname,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSlug, searchOrg, orgs, navigate, pathname])

  const setOrg = (slug: string) => {
    if (slug === searchOrg) return
    writeStoredOrg(slug)
    void navigate({
      // Replace rather than push so switching orgs doesn't stack history
      // entries the Back button would have to walk through.
      replace: true,
      search: (prev) => ({ ...prev, org: slug }),
      to: pathname,
    })
  }

  return {
    activeOrg: orgs.find((org) => org.slug === activeSlug) ?? null,
    activeSlug,
    isEmpty: orgs.length === 0,
    orgs,
    setOrg,
  }
}

/**
 * The active org slug as reflected in the URL. Used by the individual settings
 * pages; the shell guarantees `?org=` is populated before they need it.
 */
export function useSettingsOrgSlug() {
  const search = useSearch({ from: SETTINGS_ROUTE })
  return (search as { org?: string }).org
}
