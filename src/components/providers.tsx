import type { ReactNode } from "react"

import { AppConvexProvider } from "@/lib/convex/convex-provider"

export function Providers({
  children,
  initialToken,
}: {
  children: ReactNode
  initialToken?: string | null
}) {
  return (
    <AppConvexProvider initialToken={initialToken}>
      {children}
    </AppConvexProvider>
  )
}
