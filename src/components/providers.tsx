import type { ReactNode } from "react"
import type { ConvexQueryClient } from "kitcn/react"

import { AppConvexProvider } from "@/lib/convex/convex-provider"

export function Providers({
  children,
  convexQueryClient,
  initialToken,
}: {
  children: ReactNode
  convexQueryClient: ConvexQueryClient
  initialToken?: string | null
}) {
  return (
    <AppConvexProvider
      convexQueryClient={convexQueryClient}
      initialToken={initialToken}
    >
      {children}
    </AppConvexProvider>
  )
}
