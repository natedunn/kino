import {
  EmailButton,
  EmailFallbackLink,
  EmailHeading,
  EmailLayout,
  EmailText,
} from "./layout"
import type { EmailProps, EmailType } from "@nuntly/better-email"

/**
 * React Email templates for Better Auth + general transactional mail.
 * Keyed by `@nuntly/better-email`'s EmailType; each receives its typed context.
 * Wired into the auth provider in convex/functions/auth.ts via ReactEmailRenderer.
 */

function VerificationEmail({ user, url }: EmailProps<"verification-email">) {
  const name = user.name || user.email
  return (
    <EmailLayout preview="Verify your email address">
      <EmailHeading>Verify your email</EmailHeading>
      <EmailText>Hi {name}, confirm your email address to finish setting up your account.</EmailText>
      <EmailButton href={url}>Verify email</EmailButton>
      <EmailFallbackLink url={url} />
    </EmailLayout>
  )
}

function ResetPasswordEmail({ user, url }: EmailProps<"reset-password">) {
  const name = user.name || user.email
  return (
    <EmailLayout preview="Reset your password">
      <EmailHeading>Reset your password</EmailHeading>
      <EmailText>
        Hi {name}, we received a request to reset your password. Click below to choose a new one.
        If you didn’t ask for this, you can ignore this email.
      </EmailText>
      <EmailButton href={url}>Reset password</EmailButton>
      <EmailFallbackLink url={url} />
    </EmailLayout>
  )
}

function OrganizationInvitationEmail({
  organization,
  inviter,
  invitation,
}: EmailProps<"organization-invitation">) {
  const inviterName = inviter.user.name || inviter.user.email || "Someone"
  // Better Auth's acceptInvitation is keyed by the invitation id; the frontend
  // route reads it from the URL.
  const acceptUrl = `${getSiteUrl()}/auth/accept-invitation?invitationId=${invitation.id}`
  return (
    <EmailLayout preview={`Join ${organization.name} on Kino`}>
      <EmailHeading>Join {organization.name}</EmailHeading>
      <EmailText>
        {inviterName} invited you to join <strong>{organization.name}</strong> on Kino as{" "}
        {invitation.role}.
      </EmailText>
      <EmailButton href={acceptUrl}>Accept invitation</EmailButton>
      <EmailFallbackLink url={acceptUrl} />
    </EmailLayout>
  )
}

function getSiteUrl() {
  const env = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env
  return (env?.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")
}

export const emailTemplates: {
  [K in EmailType]?: (props: EmailProps<K>) => React.ReactElement
} = {
  "verification-email": VerificationEmail,
  "reset-password": ResetPasswordEmail,
  "organization-invitation": OrganizationInvitationEmail,
}

export const emailSubjects: {
  [K in EmailType]?: string | ((ctx: { type: K } & EmailProps<K>) => string)
} = {
  "verification-email": "Verify your email",
  "reset-password": "Reset your password",
  "organization-invitation": (ctx) => `Join ${ctx.organization.name} on Kino`,
}
