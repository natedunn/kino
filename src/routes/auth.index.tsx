"use client"

import { useEffect, useRef, useState } from "react"
import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { useIsAuth } from "kitcn/react"

import { getSafeRedirectTarget } from "./auth"
import { endSignOut, isSigningOut } from "@/lib/auth/sign-out-state"
import { AuthField, AuthFooter, AuthHeader } from "@/components/auth/auth-card"
import { InlineAlert } from "@/components/inline-alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Discord from "@/icons/discord"
import Github from "@/icons/github"
import Google from "@/icons/google"
import LoaderQuarter from "@/icons/loader-quarter"
import {
  trackAuthError,
  trackAuthStarted,
  trackAuthSuccess,
} from "@/lib/auth-analytics"
import { authClient } from "@/lib/convex/auth-client"

export const Route = createFileRoute("/auth/")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  component: SignInPage,
})

function SignInPage() {
  const { redirect } = Route.useSearch()
  const session = authClient.useSession()
  const router = useRouter()
  const navigate = useNavigate()
  // Server-verified auth. This flips to `false` synchronously the moment a
  // sign-out begins (kitcn clears the auth store before the network round-trip),
  // so gating the redirect on it — rather than the longer-lived Better Auth
  // session — keeps a just-signed-out user on /auth instead of bouncing them
  // back into the app while the session cookie is still being cleared.
  const isAuthed = useIsAuth()
  const redirectTarget = getSafeRedirectTarget(redirect)
  // The redirect navigates away; guard so it only ever fires once even if the
  // effect re-runs or an explicit sign-in success also triggers it.
  const redirectingRef = useRef(false)

  async function goToRedirect() {
    if (redirectingRef.current) return
    redirectingRef.current = true
    // Re-run the root `beforeLoad` so it re-reads the (now-present) auth cookie
    // and refreshes `loaderToken`, then SPA-navigate. This replaces a full
    // `window.location.replace`, avoiding a whole-document reload (re-running
    // SSR, re-downloading the JS/CSS/font bundles, white flash).
    await router.invalidate()
    // `redirectTarget` is a validated same-origin path from
    // `getSafeRedirectTarget`; the typed router can't express an arbitrary
    // runtime path, so assert the route type here.
    await navigate({ replace: true, to: redirectTarget as never })
  }

  // Already-authenticated visitor landed on /auth — bounce them into the app.
  // While a sign-out is settling, client auth state transiently still reads as
  // authenticated, so suppress the redirect until the Better Auth session is
  // genuinely gone (at which point we also lift the sign-out suppression).
  useEffect(() => {
    if (!session.data?.user) {
      endSignOut()
      return
    }
    if (isAuthed && !isSigningOut()) {
      void goToRedirect()
    }
  }, [isAuthed, session.data?.user])

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  // Which action is mid-flight. On success a page navigation follows, so we keep
  // the spinner up (don't clear it); we only clear on error so the user can retry.
  const [submitting, setSubmitting] = useState<"github" | "password" | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  // Set when sign-in is rejected because the email isn't verified yet. We then
  // offer a one-click resend instead of a dead-end error.
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">(
    "idle"
  )
  const busy = submitting !== null

  async function onResendVerification() {
    setResendState("sending")
    try {
      await authClient.sendVerificationEmail({
        email,
        callbackURL: new URL(
          "/auth/verify-email",
          window.location.origin
        ).toString(),
      })
      trackAuthSuccess("email_verification", { method: "resend" })
      setResendState("sent")
    } catch (err) {
      trackAuthError("email_verification", err, { method: "resend" })
      setResendState("idle")
      setError(
        err instanceof Error ? err.message : "Could not resend the email."
      )
    }
  }

  function callbackURL() {
    return new URL(redirectTarget, window.location.origin).toString()
  }

  async function onGithub() {
    setError(null)
    setSubmitting("github")
    // OAuth completes after a redirect off this page, so we can only observe the
    // start and any immediate error here.
    trackAuthStarted("sign_in", { method: "github" })
    try {
      const res = await authClient.signIn.social({
        provider: "github",
        callbackURL: callbackURL(),
      })
      // Success initiates an OAuth redirect — leave the spinner up.
      if (res.error) {
        trackAuthError("sign_in", res.error, { method: "github" })
        setError(res.error.message ?? "Could not start GitHub sign-in.")
        setSubmitting(null)
      }
    } catch (err) {
      trackAuthError("sign_in", err, { method: "github" })
      setError(err instanceof Error ? err.message : "Something went wrong.")
      setSubmitting(null)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNeedsVerification(false)
    setResendState("idle")
    setSubmitting("password")
    try {
      const res = await authClient.signIn.email({
        email,
        password,
        callbackURL: callbackURL(),
      })
      if (res.error) {
        trackAuthError("sign_in", res.error, { method: "password" })
        // Email-and-password accounts must verify before they can sign in
        // (requireEmailVerification). Surface a resend affordance rather than a
        // dead-end error.
        if (
          res.error.code === "EMAIL_NOT_VERIFIED" ||
          res.error.status === 403
        ) {
          setNeedsVerification(true)
        } else {
          setError(res.error.message ?? "Could not sign in.")
        }
        setSubmitting(null)
      } else {
        trackAuthSuccess("sign_in", { method: "password" })
        // SPA-navigate (keep the spinner up through the transition) instead of
        // a full-page reload — see `goToRedirect`.
        await goToRedirect()
      }
    } catch (err) {
      trackAuthError("sign_in", err, { method: "password" })
      setError(err instanceof Error ? err.message : "Something went wrong.")
      setSubmitting(null)
    }
  }

  // Session is live and we're authenticated (or mid sign-in) but the redirect
  // hasn't completed yet — show a spinner instead of an empty card. Copy
  // reflects whether a sign-in is actually in flight (just signed in) vs. an
  // already-authenticated visitor being bounced. The `isAuthed || busy` gate
  // means a *just-signed-out* visitor (whose Better Auth session lingers for a
  // moment while the cookie clears) sees the sign-in form, not a stuck spinner —
  // as does `!isSigningOut()`, which covers the window where auth state
  // transiently re-reads as authenticated mid sign-out.
  if (session.data?.user && (isAuthed || busy) && !isSigningOut()) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-6 text-muted-foreground">
        <LoaderQuarter className="size-6 animate-spin" />
        <p className="text-sm">{busy ? "Signing you in…" : "Redirecting…"}</p>
      </div>
    )
  }

  return (
    <>
      <AuthHeader
        title="Sign in"
        description="Welcome back. Sign in to continue to Kino."
      />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Button
            disabled={busy}
            onClick={onGithub}
            size="lg"
            type="button"
            variant="outline"
          >
            {submitting === "github" ? (
              <LoaderQuarter className="animate-spin" />
            ) : (
              <Github />
            )}
            Continue with GitHub
          </Button>
          {/* Disabled for now — wired up later. */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              disabled
              size="lg"
              title="Coming soon"
              type="button"
              variant="outline"
            >
              <Google />
              Google
            </Button>
            <Button
              disabled
              size="lg"
              title="Coming soon"
              type="button"
              variant="outline"
            >
              <Discord />
              Discord
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <span>or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <AuthField id="email" label="Email">
            <Input
              size="lg"
              autoComplete="email"
              id="email"
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              value={email}
            />
          </AuthField>

          <AuthField id="password" label="Password">
            <Input
              size="lg"
              autoComplete="current-password"
              id="password"
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              value={password}
            />
          </AuthField>

          {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}

          {needsVerification ? (
            <InlineAlert variant="warning">
              {resendState === "sent" ? (
                <>
                  Verification link sent to {email}. Check your inbox, then sign
                  in.
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <span>
                    Your email isn’t verified yet. Verify it to finish signing
                    in.
                  </span>
                  <Button
                    disabled={resendState === "sending"}
                    onClick={onResendVerification}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {resendState === "sending"
                      ? "Sending…"
                      : "Resend verification email"}
                  </Button>
                </div>
              )}
            </InlineAlert>
          ) : null}

          <Button disabled={busy} size="lg" type="submit">
            {submitting === "password" ? (
              <>
                <LoaderQuarter className="animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>

          <Link
            className="link-text text-center text-sm text-muted-foreground"
            to="/auth/forgot-password"
          >
            Forgot your password?
          </Link>
        </form>
      </div>
      <AuthFooter>
        Don’t have an account?{" "}
        <Link
          className="link-text font-medium text-foreground"
          to="/auth/sign-up"
        >
          Create one
        </Link>
      </AuthFooter>
    </>
  )
}
