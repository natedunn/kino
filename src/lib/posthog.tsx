"use client"

import { PostHogProvider as ReactPostHogProvider } from "@posthog/react"
import { useRouterState } from "@tanstack/react-router"
import posthog from "posthog-js"
import { useEffect, useRef } from "react"
import type { PostHogConfig } from "posthog-js"
import type { ReactNode } from "react"

import type { AppEnvironment } from "@/lib/app-env"
import { authClient } from "@/lib/convex/auth-client"

const POSTHOG_TOKEN = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST

function canUsePostHog(appEnvironment: AppEnvironment) {
  return (
    appEnvironment === "production" &&
    typeof window !== "undefined" &&
    !!POSTHOG_TOKEN &&
    !!POSTHOG_HOST
  )
}

function createPostHogOptions(): Partial<PostHogConfig> {
  return {
    api_host: POSTHOG_HOST,
    autocapture: false,
    capture_exceptions: true,
    capture_pageleave: true,
    capture_pageview: false,
    defaults: "2026-05-30",
    mask_all_element_attributes: true,
    mask_all_text: true,
    mask_personal_data_properties: true,
    person_profiles: "identified_only",
    session_recording: {
      blockClass: "ph-no-capture",
      blockSelector: ".ph-no-capture, [data-ph-no-capture], [data-sensitive]",
      maskAllInputs: true,
      maskInputOptions: {
        color: true,
        date: true,
        "datetime-local": true,
        email: true,
        month: true,
        number: true,
        password: true,
        range: true,
        search: true,
        select: true,
        tel: true,
        text: true,
        textarea: true,
        time: true,
        url: true,
        week: true,
      },
      maskTextSelector:
        ".ph-mask, [data-ph-mask], input, textarea, select, [contenteditable]",
    },
  }
}

let hasInitializedPostHog = false

function ensurePostHog(appEnvironment: AppEnvironment) {
  if (!canUsePostHog(appEnvironment)) return null

  if (!hasInitializedPostHog) {
    const token = POSTHOG_TOKEN

    if (!token) return null

    posthog.init(token, createPostHogOptions())
    hasInitializedPostHog = true
  }

  return posthog
}

export function PostHogProvider({
  appEnvironment,
  children,
}: {
  appEnvironment: AppEnvironment
  children: ReactNode
}) {
  const client = ensurePostHog(appEnvironment)

  if (!client) {
    return children
  }

  return (
    <ReactPostHogProvider client={client}>
      <PostHogPageviewTracker />
      <PostHogIdentitySync />
      {children}
    </ReactPostHogProvider>
  )
}

function PostHogPageviewTracker() {
  const location = useRouterState({ select: (state) => state.location })

  useEffect(() => {
    const url = new URL(window.location.href)

    posthog.capture("$pageview", {
      $current_url: `${url.origin}${location.pathname}`,
      path: location.pathname,
    })
  }, [location.pathname, location.searchStr])

  return null
}

export function capturePostHogException(
  error: unknown,
  properties?: Record<string, unknown>
) {
  if (!hasInitializedPostHog) return

  posthog.captureException(error, properties)
}

export function capturePostHogEvent(
  eventName: string,
  properties?: Record<string, unknown>
) {
  if (!hasInitializedPostHog) return

  posthog.capture(eventName, properties)
}

export function captureAppError(
  error: unknown,
  properties?: Record<string, unknown>
) {
  capturePostHogException(error, {
    appError: true,
    ...properties,
  })
}

function PostHogIdentitySync() {
  const session = authClient.useSession()
  const identifiedUserId = useRef<string | null>(null)

  useEffect(() => {
    if (session.isPending) return

    const user = session.data?.user

    if (!user) {
      if (identifiedUserId.current) {
        posthog.reset()
        identifiedUserId.current = null
      }
      return
    }

    if (identifiedUserId.current === user.id) return

    posthog.identify(user.id, {
      email: user.email,
      name: user.name,
    })
    identifiedUserId.current = user.id
  }, [session.data?.user, session.isPending])

  return null
}
