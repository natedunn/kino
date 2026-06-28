"use client"

import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"

import { AuthField, AuthFooter, AuthHeader } from "@/components/auth/auth-card"
import { InlineAlert } from "@/components/inline-alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { trackAuthError, trackAuthSuccess } from "@/lib/auth-analytics"
import { authClient } from "@/lib/convex/auth-client"
import { titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/auth/sign-up")({
  head: () => ({ meta: [titleMeta(["Create account"])] }),
  component: SignUpPage,
})

function SignUpPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [confirmEmail, setConfirmEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const emailsMatch =
    email.trim().toLowerCase() === confirmEmail.trim().toLowerCase()
  const passwordsMatch = password === confirmPassword
  const showEmailMismatch = confirmEmail.length > 0 && !emailsMatch
  const showPasswordMismatch = confirmPassword.length > 0 && !passwordsMatch

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!emailsMatch) {
      setError("Email addresses don’t match.")
      return
    }
    if (!passwordsMatch) {
      setError("Passwords don’t match.")
      return
    }
    setError(null)
    setPending(true)
    try {
      const res = await authClient.signUp.email({
        name,
        email,
        password,
        callbackURL: new URL(
          "/auth/verify-email",
          window.location.origin
        ).toString(),
      })
      if (res.error) {
        trackAuthError("sign_up", res.error)
        setError(res.error.message ?? "Could not create your account.")
      } else {
        trackAuthSuccess("sign_up")
        setDone(true)
      }
    } catch (err) {
      trackAuthError("sign_up", err)
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <>
        <AuthHeader
          title="Verify your email"
          description="One more step before you can sign in."
        />
        <InlineAlert variant="success">
          We sent a verification link to {email}. Click it to confirm your
          address, then sign in to continue.
        </InlineAlert>
        <AuthFooter>
          <Link className="link-text font-medium text-foreground" to="/auth">
            Back to sign in
          </Link>
        </AuthFooter>
      </>
    )
  }

  const canSubmit =
    !pending &&
    name.trim().length > 0 &&
    email.length > 0 &&
    confirmEmail.length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    emailsMatch &&
    passwordsMatch

  return (
    <>
      <AuthHeader
        title="Create your account"
        description="Sign up with your email and a password."
      />
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <AuthField id="name" label="Name">
          <Input
            size="lg"
            autoComplete="name"
            id="name"
            onChange={(e) => setName(e.target.value)}
            required
            value={name}
          />
        </AuthField>
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
        <AuthField id="confirm-email" label="Confirm email">
          <Input
            size="lg"
            aria-invalid={showEmailMismatch}
            autoComplete="email"
            id="confirm-email"
            onChange={(e) => setConfirmEmail(e.target.value)}
            required
            type="email"
            value={confirmEmail}
          />
          {showEmailMismatch ? (
            <p className="text-xs text-destructive">
              Email addresses don’t match.
            </p>
          ) : null}
        </AuthField>
        <AuthField id="password" label="Password">
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
        <AuthField id="confirm-password" label="Confirm password">
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
        <Button disabled={!canSubmit} size="lg" type="submit">
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <AuthFooter>
        Already have an account?{" "}
        <Link className="link-text font-medium text-foreground" to="/auth">
          Sign in
        </Link>
      </AuthFooter>
    </>
  )
}
