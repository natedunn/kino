import type { ReactNode } from "react"
import type { QueryClient } from "@tanstack/react-query"
import type { ConvexQueryClient } from "kitcn/react"

import {
  HeadContent,
  Outlet,
  ScriptOnce,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"

import { DefaultCatchBoundary } from "@/components/_default-catch-boundary"
import { Providers } from "@/components/providers"
import { Toaster } from "@/components/ui/sonner"
import { getFaviconHref, inferAppEnvironment } from "@/lib/app-env"
import appCss from "../styles.css?url"

const getLoaderToken = createServerFn({ method: "GET" }).handler(async () => {
  const { getServerAuthToken } = await import("@/lib/convex/auth-start-token")
  return await getServerAuthToken()
})

const getAppEnvironment = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getRequest } = await import("@tanstack/react-start/server")
    const request = getRequest()

    return inferAppEnvironment({
      hostname: new URL(request.url).hostname,
      isDev: import.meta.env.DEV,
    })
  }
)

export const Route = createRootRouteWithContext<{
  loaderToken?: string | null
  convexQueryClient: ConvexQueryClient
  queryClient: QueryClient
}>()({
  beforeLoad: async ({ context }) => {
    const loaderToken = await getLoaderToken()

    if (loaderToken) {
      context.convexQueryClient.serverHttpClient?.setAuth(loaderToken)
    }

    return {
      loaderToken,
    }
  },
  loader: async () => {
    return {
      appEnvironment: await getAppEnvironment(),
    }
  },
  head: ({ loaderData }) => {
    const faviconHref = getFaviconHref(
      loaderData?.appEnvironment ?? "production"
    )

    return {
      meta: [
        {
          charSet: "utf-8",
        },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },
        {
          title: "Kino",
        },
      ],
      links: [
        {
          rel: "icon",
          href: faviconHref,
          type: "image/svg+xml",
        },
        {
          rel: "stylesheet",
          href: appCss,
        },
        {
          rel: "preconnect",
          href: "https://fonts.googleapis.com",
        },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossOrigin: "",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap",
        },
      ],
    }
  },
  component: RootComponent,
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <div>Not found</div>,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  const showDevtools = import.meta.env.DEV

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ScriptOnce>
          {`document.documentElement.classList.toggle('dark', localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches))`}
        </ScriptOnce>
        {children}
        <Toaster closeButton richColors />
        {showDevtools ? (
          <TanStackDevtools
            config={{
              position: "bottom-right",
            }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  const { convexQueryClient, loaderToken } = Route.useRouteContext()

  return (
    <Providers convexQueryClient={convexQueryClient} initialToken={loaderToken}>
      <Outlet />
    </Providers>
  )
}
