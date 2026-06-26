import { useEffect } from "react"
import { isCancelledError } from "@tanstack/react-query"
import {
  ErrorComponent,
  Link,
  rootRouteId,
  useMatch,
  useRouter,
} from "@tanstack/react-router"
import type { ErrorComponentProps } from "@tanstack/react-router"

import { RoutePending } from "@/components/route-pending"
import { captureAppError } from "@/lib/posthog"

function isTransientQueryCancellation(error: unknown) {
  return (
    isCancelledError(error) ||
    (error instanceof Error && error.message === "CancelledError")
  )
}

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter()
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  })
  const isQueryCancellation = isTransientQueryCancellation(error)

  useEffect(() => {
    if (!isQueryCancellation) return

    void router.invalidate()
  }, [isQueryCancellation, router])

  useEffect(() => {
    if (isQueryCancellation) return

    captureAppError(error, {
      routeErrorBoundary: true,
      routeId: isRoot ? "root" : "route",
    })
  }, [error, isQueryCancellation, isRoot])

  if (isQueryCancellation) {
    return <RoutePending variant="page" />
  }

  console.error(error)

  return (
    <div className="mx-auto flex w-full max-w-300 flex-1 flex-col items-center gap-2 p-4">
      <div className="w-full text-2xl font-bold">
        <ErrorComponent error={error} />
      </div>
      <div className="flex w-full flex-wrap items-start gap-2">
        <button
          onClick={() => {
            router.invalidate()
          }}
          className={`rounded bg-gray-600 px-2 py-1 font-extrabold text-white uppercase dark:bg-gray-700`}
        >
          Try Again
        </button>
        {isRoot ? (
          <Link
            to="/"
            className={`rounded bg-gray-600 px-2 py-1 font-extrabold text-white uppercase dark:bg-gray-700`}
          >
            Home
          </Link>
        ) : (
          <Link
            to="/"
            className={`rounded bg-gray-600 px-2 py-1 font-extrabold text-white uppercase dark:bg-gray-700`}
            onClick={(e) => {
              e.preventDefault()
              window.history.back()
            }}
          >
            Go Back
          </Link>
        )}
      </div>
    </div>
  )
}
