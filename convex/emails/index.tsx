import { getEnv } from '../lib/get-env';
import { EmailButton, EmailFallbackLink, EmailHeading, EmailLayout, EmailText } from './layout';

/**
 * React Email templates for Better Auth transactional mail. Each component takes
 * the props the matching Better Auth callback provides (mapped in
 * convex/functions/auth.ts) and is rendered to HTML + sent via Bento by
 * convex/emails/send.ts.
 */

type EmailUser = { name?: string | null; email: string };

export type VerificationEmailProps = { user: EmailUser; url: string };
export type ResetPasswordEmailProps = { user: EmailUser; url: string };
export type OrganizationInvitationEmailProps = {
	organization: { name: string };
	inviter: { user: EmailUser };
	invitation: { id: string; role: string };
};

export function VerificationEmail({ user, url }: VerificationEmailProps) {
	const name = user.name || user.email;
	return (
		<EmailLayout preview='Verify your email address'>
			<EmailHeading>Verify your email</EmailHeading>
			<EmailText>
				Hi {name}, confirm your email address to finish setting up your account.
			</EmailText>
			<EmailButton href={url}>Verify email</EmailButton>
			<EmailFallbackLink url={url} />
		</EmailLayout>
	);
}

export function ResetPasswordEmail({ user, url }: ResetPasswordEmailProps) {
	const name = user.name || user.email;
	return (
		<EmailLayout preview='Reset your password'>
			<EmailHeading>Reset your password</EmailHeading>
			<EmailText>
				Hi {name}, we received a request to reset your password. Click below to choose a new one. If
				you didn’t ask for this, you can ignore this email.
			</EmailText>
			<EmailButton href={url}>Reset password</EmailButton>
			<EmailFallbackLink url={url} />
		</EmailLayout>
	);
}

export function OrganizationInvitationEmail({
	organization,
	inviter,
	invitation,
}: OrganizationInvitationEmailProps) {
	const inviterName = inviter.user.name || inviter.user.email || 'Someone';
	// Better Auth's acceptInvitation is keyed by the invitation id; the frontend
	// route reads it from the URL.
	const acceptUrl = `${getSiteUrl()}/auth/accept-invitation?invitationId=${invitation.id}`;
	return (
		<EmailLayout preview={`Join ${organization.name} on Kino`}>
			<EmailHeading>Join {organization.name}</EmailHeading>
			<EmailText>
				{inviterName} invited you to join <strong>{organization.name}</strong> on Kino as{' '}
				{invitation.role}.
			</EmailText>
			<EmailButton href={acceptUrl}>Accept invitation</EmailButton>
			<EmailFallbackLink url={acceptUrl} />
		</EmailLayout>
	);
}

function getSiteUrl() {
	// Reuse the validated app env (single source of truth) instead of re-reading
	// process.env with a hand-rolled localhost fallback — otherwise a missing
	// SITE_URL would silently point invitation links at localhost.
	return getEnv().SITE_URL.replace(/\/$/, '');
}

export const emailSubjects = {
	verification: 'Verify your email',
	resetPassword: 'Reset your password',
	organizationInvitation: (organizationName: string) => `Join ${organizationName} on Kino`,
};
