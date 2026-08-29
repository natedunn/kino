'use client';

import { useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';

import { AuthFooter, AuthHeader } from '@/components/auth/auth-card';
import { InlineAlert } from '@/components/inline-alert';
import { trackAuthError, trackAuthSuccess } from '@/lib/auth-analytics';
import { titleMeta } from '@/lib/seo';
import * as m from '@/paraglide/messages.js';

export const Route = createFileRoute('/auth/verify-email')({
	head: () => ({ meta: [titleMeta([m.auth_verify_email_meta()])] }),
	validateSearch: (
		search: Record<string, unknown>
	): { error?: string; redirect?: string; verified: boolean } => ({
		...(typeof search.error === 'string' ? { error: search.error } : {}),
		...(typeof search.redirect === 'string' ? { redirect: search.redirect } : {}),
		verified: search.verified === '1',
	}),
	component: VerifyEmailPage,
});

function VerifyEmailPage() {
	// Better Auth verifies the token on the API side and redirects here with the
	// outcome. We only render the result.
	const { error, redirect, verified } = Route.useSearch();
	const ok = verified && !error;
	const invalid = !verified && !error;

	useEffect(() => {
		if (ok) trackAuthSuccess('email_verification');
		else if (error) trackAuthError('email_verification', error);
	}, [ok, error]);

	return (
		<>
			<AuthHeader
				title={
					ok
						? m.auth_email_verified()
						: invalid
							? m.auth_invalid_verification_link()
							: m.auth_verification_failed()
				}
			/>
			{ok ? (
				<InlineAlert variant='success'>{m.auth_email_confirmed()}</InlineAlert>
			) : invalid ? (
				<InlineAlert variant='danger'>{m.auth_verification_invalid()}</InlineAlert>
			) : (
				<InlineAlert variant='danger'>{m.auth_verification_expired()}</InlineAlert>
			)}
			<AuthFooter>
				<Link className='link-text font-medium text-foreground' search={{ redirect }} to='/auth'>
					{m.auth_continue_sign_in()}
				</Link>
			</AuthFooter>
		</>
	);
}
