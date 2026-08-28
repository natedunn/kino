import type { AppLocale } from '../shared/i18n';

import { getEmailCopy } from './i18n';
import { EmailButton, EmailFallbackLink, EmailHeading, EmailLayout, EmailText } from './layout';

/**
 * React Email templates for Better Auth transactional mail. Each component takes
 * the props the matching Better Auth callback provides (mapped in
 * convex/functions/auth.ts) and is rendered to HTML + sent via Bento by
 * convex/emails/send.ts.
 */

type EmailUser = { name?: string | null; email: string };

export type VerificationEmailProps = { locale: AppLocale; user: EmailUser; url: string };
export type ResetPasswordEmailProps = { locale: AppLocale; user: EmailUser; url: string };
export type OrganizationInvitationEmailProps = {
	locale: AppLocale;
	organization: { name: string };
	inviter: { user: EmailUser };
	invitation: { id: string; role: string };
	/**
	 * Origin for the accept link. Callers resolve this per-environment (the
	 * inviter's own browsing origin, validated against the trusted-origin set)
	 * via resolveTrustedSiteUrl — see orgMember.inviteMember.
	 */
	siteUrl: string;
};

export function VerificationEmail({ locale, user, url }: VerificationEmailProps) {
	const name = user.name || user.email;
	const copy = getEmailCopy(locale);
	return (
		<EmailLayout locale={locale} preview={copy.verification.preview}>
			<EmailHeading>{copy.verification.heading}</EmailHeading>
			<EmailText>{copy.verification.body(name)}</EmailText>
			<EmailButton href={url}>{copy.verification.button}</EmailButton>
			<EmailFallbackLink label={copy.fallbackLink} url={url} />
		</EmailLayout>
	);
}

export function ResetPasswordEmail({ locale, user, url }: ResetPasswordEmailProps) {
	const name = user.name || user.email;
	const copy = getEmailCopy(locale);
	return (
		<EmailLayout locale={locale} preview={copy.reset.preview}>
			<EmailHeading>{copy.reset.heading}</EmailHeading>
			<EmailText>{copy.reset.body(name)}</EmailText>
			<EmailButton href={url}>{copy.reset.button}</EmailButton>
			<EmailFallbackLink label={copy.fallbackLink} url={url} />
		</EmailLayout>
	);
}

export function OrganizationInvitationEmail({
	organization,
	inviter,
	invitation,
	locale,
	siteUrl,
}: OrganizationInvitationEmailProps) {
	const copy = getEmailCopy(locale);
	const inviterName = inviter.user.name || inviter.user.email || copy.invitation.someone;
	const role = copy.roles[invitation.role as keyof typeof copy.roles] ?? invitation.role;
	// Better Auth's acceptInvitation is keyed by the invitation id; the frontend
	// route reads it from the URL.
	const acceptUrl = `${siteUrl.replace(/\/$/, '')}/auth/accept-invitation?invitationId=${invitation.id}`;
	return (
		<EmailLayout locale={locale} preview={copy.invitation.preview(organization.name)}>
			<EmailHeading>{copy.invitation.heading(organization.name)}</EmailHeading>
			<EmailText>
				{copy.invitation.body({ inviter: inviterName, organization: organization.name, role })}
			</EmailText>
			<EmailButton href={acceptUrl}>{copy.invitation.button}</EmailButton>
			<EmailFallbackLink label={copy.fallbackLink} url={acceptUrl} />
		</EmailLayout>
	);
}
