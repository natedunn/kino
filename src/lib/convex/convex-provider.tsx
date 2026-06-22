"use client"

import { useQueryClient } from "@tanstack/react-query"
import { ConvexAuthProvider } from "kitcn/auth/client"
import {
  type ConvexQueryClient,
  useAuthStore,
  useFetchAccessToken,
} from "kitcn/react"
import { useEffect } from "react"
import type { ReactNode } from "react"

import { authClient } from "@/lib/convex/auth-client"
import { CRPCProvider } from "@/lib/convex/crpc"

export function AppConvexProvider({
  children,
  convexQueryClient,
  initialToken,
}: {
  children: ReactNode
  convexQueryClient: ConvexQueryClient
  initialToken?: string | null
}) {
  return (
    <ConvexAuthProvider
      authClient={authClient}
      client={convexQueryClient.convexClient}
      initialToken={initialToken ?? undefined}
    >
      <QueryProvider convexQueryClient={convexQueryClient}>
        {children}
      </QueryProvider>
    </ConvexAuthProvider>
  )
}

function QueryProvider({
  children,
  convexQueryClient,
}: {
  children: ReactNode
  convexQueryClient: ConvexQueryClient
}) {
  const authStore = useAuthStore()
  const queryClient = useQueryClient()
  convexQueryClient.updateAuthStore(authStore)
  convexQueryClient.connect(queryClient)

  return (
    <CRPCProvider
      convexClient={convexQueryClient.convexClient}
      convexQueryClient={convexQueryClient}
    >
      <ConvexTokenBootstrap />
      <ConvexAuthWakeRefresher />
      {children}
    </CRPCProvider>
  )
}

function decodeJwtExp(token: string) {
  try {
    const payload = token.split(".")[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    )
    const decoded = JSON.parse(atob(padded)) as { exp?: number }
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null
  } catch {
    return null
  }
}

function ConvexTokenBootstrap() {
  const authStore = useAuthStore()
  const session = authClient.useSession()

  useEffect(() => {
    if (!session.data?.session || authStore.get("token")) return

    let cancelled = false

    authClient.convex
      .token({ fetchOptions: { throw: false } })
      .then((result) => {
        const token = result.data?.token ?? null
        if (cancelled || !token) return

        authStore.set("token", token)
        authStore.set("expiresAt", decodeJwtExp(token))
        authStore.set("isAuthenticated", true)
        authStore.set("sessionSyncGraceUntil", null)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [authStore, session.data?.session])

  return null
}

// Re-mint the Convex access token the moment a backgrounded tab is reactivated.
//
// Convex JWTs are short-lived, but the Better Auth session is long-lived (~30d).
// When a tab sits idle for hours, the in-memory Convex token expires while the
// session stays valid. `ConvexTokenBootstrap` only mints a token when none
// exists, and `refetchOnWindowFocus: false` means the session reference never
// changes on wake — so nothing proactively refreshes the expired token, and
// auth-required queries can briefly fail on reconnect.
//
// On wake we force a token refresh from the live session (public kitcn API).
// This is cooperative and safe: with no session it returns null without a
// network call, and it can never invalidate a still-valid session.
function ConvexAuthWakeRefresher() {
  const authStore = useAuthStore()
  const fetchAccessToken = useFetchAccessToken()

  useEffect(() => {
    if (!fetchAccessToken) return

    const REFRESH_THRESHOLD_MS = 2 * 60 * 1000

    const refreshIfStale = () => {
      if (document.visibilityState !== "visible") return

      const hasToken = !!authStore.get("token")
      const expiresAt = authStore.get("expiresAt")

      // Skip when the cached token is still comfortably valid — only refresh
      // when it is missing or about to / already expired.
      if (
        hasToken &&
        expiresAt &&
        expiresAt - Date.now() > REFRESH_THRESHOLD_MS
      ) {
        return
      }

      void fetchAccessToken({ forceRefreshToken: true })
    }

    document.addEventListener("visibilitychange", refreshIfStale)
    window.addEventListener("focus", refreshIfStale)
    // bfcache restore (iOS Safari / Android Chrome) may fire only pageshow,
    // not focus/visibilitychange — exactly the "wake after hours" case.
    window.addEventListener("pageshow", refreshIfStale)

    return () => {
      document.removeEventListener("visibilitychange", refreshIfStale)
      window.removeEventListener("focus", refreshIfStale)
      window.removeEventListener("pageshow", refreshIfStale)
    }
  }, [authStore, fetchAccessToken])

  return null
}
