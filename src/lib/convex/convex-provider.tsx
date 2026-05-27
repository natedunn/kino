"use client"

import { useQueryClient } from "@tanstack/react-query"
import { ConvexAuthProvider } from "kitcn/auth/client"
import { type ConvexQueryClient, useAuthStore, useAuthValue } from "kitcn/react"
import { useEffect, useRef } from "react"
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
      <InitialAuthStoreBootstrap initialToken={initialToken}>
        <QueryProvider convexQueryClient={convexQueryClient}>
          {children}
        </QueryProvider>
      </InitialAuthStoreBootstrap>
    </ConvexAuthProvider>
  )
}

function InitialAuthStoreBootstrap({
  children,
  initialToken,
}: {
  children: ReactNode
  initialToken?: string | null
}) {
  const authStore = useAuthStore()
  const didBootstrapRef = useRef(false)
  const token = useAuthValue("token")
  const isAuthenticated = useAuthValue("isAuthenticated")
  const isLoading = useAuthValue("isLoading")

  if (!didBootstrapRef.current) {
    didBootstrapRef.current = true

    if (initialToken) {
      authStore.set("token", initialToken)
      authStore.set("expiresAt", decodeJwtExp(initialToken))
      authStore.set("isAuthenticated", true)
      authStore.set("isLoading", false)
      authStore.set("sessionSyncGraceUntil", null)
    }
  }

  if (initialToken && token && isLoading && !isAuthenticated) {
    // Keep SSR-hydrated auth-bound queries stable while Better Auth session
    // state catches up to the server-provided Convex token.
    authStore.set("isAuthenticated", true)
  }

  return children
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
