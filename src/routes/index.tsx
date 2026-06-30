import type { ReactNode } from "react"
import { Link, createFileRoute, redirect } from "@tanstack/react-router"
import {
  ArrowRight,
  MessageSquare,
  Newspaper,
  Route as RouteIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { isClientDefinitelyAuthed } from "@/lib/auth/auth-snapshot"
import { titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [titleMeta([])],
  }),
  // Authenticated visitors go straight to the app — a real redirect, server and
  // client. This inverse gate must fail CLOSED (unlike `requireAuth`): the
  // server uses `context.isAuthenticated` (definitive from `loaderToken`), and
  // the client uses `isClientDefinitelyAuthed()` (settled-and-authed only). The
  // fail-open client signal would flash a just-loaded anonymous visitor to
  // /dashboard → /auth instead of showing the public landing page.
  beforeLoad: ({ context }) => {
    const authed =
      typeof window === "undefined"
        ? context.isAuthenticated
        : isClientDefinitelyAuthed()
    if (authed) {
      throw redirect({ to: "/dashboard", replace: true })
    }
  },
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      {/* Nav */}
      <header className="border-b border-border/50">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary">
              <span className="text-xs font-bold text-primary-foreground">
                K
              </span>
            </div>
            <span className="text-sm font-semibold tracking-tight">Kino</span>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="container py-24 md:py-32">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-muted-foreground">
              Open-source project toolkit
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
              Ship products with your team, not around them.
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Feedback boards, roadmaps, and changelogs — in one place. Give
              your users a seat at the table without losing focus.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <Button asChild>
                <Link to="/auth">
                  Start for free
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="size-4"
                    aria-hidden="true"
                  >
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                  </svg>
                  View source
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* Feature cards */}
        <section className="border-t border-border/50">
          <div className="container py-20 md:py-24">
            <div className="grid gap-px rounded-lg border border-border bg-border md:grid-cols-3">
              <FeatureCell
                icon={<MessageSquare className="size-5" />}
                title="Feedback"
                description="Collect bugs, feature requests, and ideas. Let users upvote so you know what matters."
              />
              <FeatureCell
                icon={<RouteIcon className="size-5" />}
                title="Roadmap"
                description="Share what you're working on. Move items through statuses as you build."
              />
              <FeatureCell
                icon={<Newspaper className="size-5" />}
                title="Updates"
                description="Write changelogs and announcements. Keep your users informed without the noise."
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border/50">
          <div className="container py-20 text-center md:py-24">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              Ready to get started?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Free for small teams. Set up in under a minute and start
              collecting feedback fast.
            </p>
            <div className="mt-6">
              <Button asChild>
                <Link to="/auth">
                  Create your first project
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Kino</p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCell({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-card p-8 first:rounded-t-lg last:rounded-b-lg md:p-10 md:first:rounded-tl-lg md:first:rounded-tr-none md:last:rounded-br-lg md:last:rounded-bl-none [&:nth-child(1)]:md:rounded-bl-lg [&:nth-child(3)]:md:rounded-tr-lg">
      <div className="flex items-center gap-2.5 text-foreground">
        {icon}
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  )
}
