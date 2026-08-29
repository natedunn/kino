import type {
	OrganizationInvitationEmailProps,
	ResetPasswordEmailProps,
	VerificationEmailProps,
} from './index';

import { createElement } from 'react';
// The edge build, specifically: the default browser build references
// MessageChannel at module top level, which Convex's runtime doesn't provide —
// importing it makes the whole deployment fail module analysis at push time.
import { renderToStaticMarkup } from 'react-dom/server.edge';

import { sendEmail } from '../lib/bento';
import { getEmailCopy } from './i18n';
import { OrganizationInvitationEmail, ResetPasswordEmail, VerificationEmail } from './index';

/**
 * Render a React Email template to HTML. Uses react-dom's static renderer
 * directly: Convex's runtime rejects dynamic `import()`, which
 * `@react-email/render` relies on internally. Static rendering only supports
 * synchronous trees, which all our templates are.
 */
function renderEmail(element: React.ReactElement) {
	return `<!DOCTYPE html>${renderToStaticMarkup(element)}`;
}

/**
 * Render and send through Bento. Only callable from action/HTTP-action
 * contexts (outbound fetch) — the Better Auth verification and reset flows
 * qualify because they run inside auth HTTP routes.
 */
function renderAndSend(args: { to: string; subject: string; element: React.ReactElement }) {
	return sendEmail({ to: args.to, subject: args.subject, html: renderEmail(args.element) });
}

export function sendVerificationEmail(props: VerificationEmailProps) {
	const copy = getEmailCopy(props.locale);
	return renderAndSend({
		to: props.user.email,
		subject: copy.verification.subject,
		element: createElement(VerificationEmail, props),
	});
}

export function sendResetPasswordEmail(props: ResetPasswordEmailProps) {
	const copy = getEmailCopy(props.locale);
	return renderAndSend({
		to: props.user.email,
		subject: copy.reset.subject,
		element: createElement(ResetPasswordEmail, props),
	});
}

/**
 * Render-only: organization invitations are created from cRPC mutations, where
 * outbound fetch is illegal. The caller renders here (pure compute) and
 * schedules the actual send through the `email.sendTransactionalEmail` action.
 */
export function renderOrganizationInvitationEmail(props: OrganizationInvitationEmailProps) {
	const copy = getEmailCopy(props.locale);
	return {
		html: renderEmail(createElement(OrganizationInvitationEmail, props)),
		subject: copy.invitation.subject(props.organization.name),
	};
}
