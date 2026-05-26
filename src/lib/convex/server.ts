import type { QueryClient } from "@tanstack/react-query"

import { ConvexHttpClient } from "convex/browser"

type LoaderToken = string | null | undefined

type ConvexLoaderQueryOptions = {
  queryKey: readonly unknown[]
  meta?: {
    authType?: unknown
    skipUnauth?: unknown
  }
  enabled?: unknown
  [key: string]: unknown
}

function getConvexQueryParts(queryKey: readonly unknown[]) {
  const [kind, functionName, args] = queryKey

  if (kind !== "convexQuery" || typeof functionName !== "string") {
    throw new Error(
      `Unsupported Convex loader query key: ${JSON.stringify(queryKey)}`
    )
  }

  return {
    args: args && args !== "skip" ? args : {},
    functionName,
  }
}

function shouldSkipForMissingAuth(
  options: ConvexLoaderQueryOptions,
  token: LoaderToken
) {
  if (token) return false

  return (
    options.meta?.authType === "required" || options.meta?.skipUnauth === true
  )
}

async function runServerQuery<TData>(
  options: ConvexLoaderQueryOptions,
  token: LoaderToken
) {
  if (shouldSkipForMissingAuth(options, token)) {
    return null as TData
  }

  const convexUrl = import.meta.env.VITE_CONVEX_URL
  if (!convexUrl) {
    throw new Error("VITE_CONVEX_URL is required for Convex route loader SSR.")
  }

  const { args, functionName } = getConvexQueryParts(options.queryKey)
  const client = new ConvexHttpClient(convexUrl)
  const serverClient = client as unknown as {
    query: (name: string, args: Record<string, unknown>) => Promise<TData>
    setAuth: (token: string) => void
    setFetchOptions: (options: { cache: "no-store" }) => void
  }

  serverClient.setFetchOptions({ cache: "no-store" })

  if (token) {
    serverClient.setAuth(token)
  }

  return serverClient.query(functionName, args as Record<string, unknown>)
}

export async function fetchConvexLoaderQuery<TData>(
  queryClient: QueryClient,
  options: ConvexLoaderQueryOptions,
  token: LoaderToken
) {
  if (options.enabled === false) {
    return null as TData
  }

  if (typeof window !== "undefined") {
    return queryClient.ensureQueryData(options as never) as Promise<TData>
  }

  return queryClient.fetchQuery({
    ...options,
    queryFn: () => runServerQuery(options, token),
  } as never) as Promise<TData>
}

export async function prefetchConvexLoaderQuery(
  queryClient: QueryClient,
  options: ConvexLoaderQueryOptions,
  token: LoaderToken
) {
  await fetchConvexLoaderQuery(queryClient, options, token)
}
