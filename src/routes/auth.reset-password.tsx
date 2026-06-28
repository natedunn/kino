"use client"

import { useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"

import { AuthField, AuthFooter, AuthHeader } from "@/components/auth/auth-card"
import { InlineAlert } from "@/components/inline-alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { trackAuthError, trackAuthSuccess } from "@/lib/auth-analytics"
import { authClient } from "@/lib/convex/auth-client"
import { titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({ meta: [titleMeta(["Set a new password"])] }),
  validateSearch: (
    search: Record<string, unknown>
  ): { token?: string; error?: string } => ({
    ...(typeof search.token === "string" ? { token: search.token } : {}),
    ...(typeof search.error === "string" ? { error: search.error } : {}),
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token, error: tokenError } = Route.useSearch()
  const navigate = useNavigate()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const passwordsMatch = password === confirmPassword
  const showPasswordMismatch = confirmPassword.length > 0 && !passwordsMatch

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    if (!passwordsMatch) {
      setError("Passwords don’t match.")
      return
    }
    setError(null)
    setPending(true)
    try {
      const res = await authClient.resetPassword({
        newPassword: password,
        token,
      })
      if (res.error) {
        trackAuthError("password_reset", res.error)
        setError(res.error.message ?? "Could not reset your password.")
      } else {
        trackAuthSuccess("password_reset")
        setDone(true)
        setTimeout(() => navigate({ to: "/auth" }), 1500)
      }
    } catch (err) {
      trackAuthError("password_reset", err)
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setPending(false)
    }
  }

  if (!token || tokenError) {
    return (
      <>
        <AuthHeader
          title="Invalid or expired link"
          description="This password reset link is no longer valid."
        />
        <InlineAlert variant="danger">
          Please request a fresh password reset email and try again.
        </InlineAlert>
        <AuthFooter>
          <Link
            className="link-text font-medium text-foreground"
            to="/auth/forgot-password"
          >
            Request a new link
          </Link>
        </AuthFooter>
      </>
    )
  }

  return (
    <>
      <AuthHeader
        title="Set a new password"
        description="Choose a new password for your account."
      />
      {done ? (
        <InlineAlert variant="success">
          Password updated. Redirecting you to sign in…
        </InlineAlert>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <AuthField id="password" label="New password">
            <Input
              size="lg"
              autoComplete="new-password"
              id="password"
              minLength={8}
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              value={password}
            />
          </AuthField>
          <AuthField id="confirm-password" label="Confirm new password">
            <Input
              size="lg"
              aria-invalid={showPasswordMismatch}
              autoComplete="new-password"
              id="confirm-password"
              minLength={8}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
            {showPasswordMismatch ? (
              <p className="text-xs text-destructive">Passwords don’t match.</p>
            ) : null}
          </AuthField>
          {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}
          <Button
            disabled={
              pending ||
              password.length === 0 ||
              confirmPassword.length === 0 ||
              !passwordsMatch
            }
            size="lg"
            type="submit"
          >
            {pending ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
    </>
  )
}
