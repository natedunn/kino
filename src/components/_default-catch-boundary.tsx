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

import { Button } from "@/components/ui/button"
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
        <Button
          onClick={() => {
            router.invalidate()
          }}
        >
          Try Again
        </Button>
        {isRoot ? (
          <Button asChild variant="outline">
            <Link to="/">Home</Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link
              to="/"
              onClick={(e) => {
                e.preventDefault()
                window.history.back()
              }}
            >
              Go Back
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}
