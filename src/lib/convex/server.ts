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

type ServerConvexClient = {
  query: (name: string, args: Record<string, unknown>) => Promise<unknown>
  setAuth: (token: string) => void
  setFetchOptions: (options: { cache: "no-store" }) => void
}

const serverClientCache = new WeakMap<QueryClient, Map<string, ServerConvexClient>>()

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

function getServerConvexClient(
  queryClient: QueryClient,
  convexUrl: string,
  token: LoaderToken
) {
  const cacheKey = `${convexUrl}\0${token ?? ""}`
  let queryClientCache = serverClientCache.get(queryClient)

  if (!queryClientCache) {
    queryClientCache = new Map()
    serverClientCache.set(queryClient, queryClientCache)
  }

  const cached = queryClientCache.get(cacheKey)
  if (cached) return cached

  const client = new ConvexHttpClient(convexUrl) as unknown as ServerConvexClient
  client.setFetchOptions({ cache: "no-store" })

  if (token) {
    client.setAuth(token)
  }

  queryClientCache.set(cacheKey, client)
  return client
}

async function runServerQuery<TData>(
  queryClient: QueryClient,
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
  const serverClient = getServerConvexClient(queryClient, convexUrl, token)

  return serverClient.query(functionName, args as Record<string, unknown>) as Promise<TData>
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
    // Kitcn installs ConvexQueryClient.queryFn() as the default client queryFn.
    return queryClient.ensureQueryData(options as never) as Promise<TData>
  }

  return queryClient.fetchQuery({
    ...options,
    queryFn: () => runServerQuery(queryClient, options, token),
  } as never) as Promise<TData>
}

export async function prefetchConvexLoaderQuery(
  queryClient: QueryClient,
  options: ConvexLoaderQueryOptions,
  token: LoaderToken
) {
  await fetchConvexLoaderQuery(queryClient, options, token)
}
