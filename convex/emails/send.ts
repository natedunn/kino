import type {
	OrganizationInvitationEmailProps,
	ResetPasswordEmailProps,
	VerificationEmailProps,
} from './index';

import { createElement } from 'react';
import { render } from '@react-email/render';

import { sendEmail } from '../lib/bento';
import {
	emailSubjects,
	OrganizationInvitationEmail,
	ResetPasswordEmail,
	VerificationEmail,
} from './index';

/**
 * Render a React Email template to HTML and send it through Bento. Called from
 * the Better Auth send callbacks wired in convex/functions/auth.ts.
 */
async function renderAndSend(args: { to: string; subject: string; element: React.ReactElement }) {
	const html = await render(args.element);
	return sendEmail({ to: args.to, subject: args.subject, html });
}

export function sendVerificationEmail(props: VerificationEmailProps) {
	return renderAndSend({
		to: props.user.email,
		subject: emailSubjects.verification,
		element: createElement(VerificationEmail, props),
	});
}

export function sendResetPasswordEmail(props: ResetPasswordEmailProps) {
	return renderAndSend({
		to: props.user.email,
		subject: emailSubjects.resetPassword,
		element: createElement(ResetPasswordEmail, props),
	});
}

export function sendOrganizationInvitationEmail(
	props: OrganizationInvitationEmailProps & { email: string }
) {
	return renderAndSend({
		to: props.email,
		subject: emailSubjects.organizationInvitation(props.organization.name),
		element: createElement(OrganizationInvitationEmail, props),
	});
}
