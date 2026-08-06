'use client';

import { useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';

import { AuthFooter, AuthHeader } from '@/components/auth/auth-card';
import { InlineAlert } from '@/components/inline-alert';
import { trackAuthError, trackAuthSuccess } from '@/lib/auth-analytics';
import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/auth/verify-email')({
	head: () => ({ meta: [titleMeta(['Verify email'])] }),
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
				title={ok ? 'Email verified' : invalid ? 'Invalid verification link' : 'Verification failed'}
			/>
			{ok ? (
				<InlineAlert variant='success'>
					Your email address is confirmed. You’re all set.
				</InlineAlert>
			) : invalid ? (
				<InlineAlert variant='danger'>
					This verification link is invalid. Open the link from your verification email or
					request a new one.
				</InlineAlert>
			) : (
				<InlineAlert variant='danger'>
					We couldn’t verify your email — the link may have expired. Sign in to request a new
					verification email.
				</InlineAlert>
			)}
			<AuthFooter>
				<Link className='link-text font-medium text-foreground' search={{ redirect }} to='/auth'>
					Continue to sign in
				</Link>
			</AuthFooter>
		</>
	);
}
