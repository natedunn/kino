'use client';

import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';

import { AuthFooter, AuthHeader } from '@/components/auth/auth-card';
import { InlineAlert } from '@/components/inline-alert';
import { Button } from '@/components/ui/button';
import { trackAuthError, trackAuthSuccess } from '@/lib/auth-analytics';
import { verifyEmail } from '@/lib/auth/auth-client';
import { useAuthLinkCode } from '@/lib/auth/use-auth-link-code';
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
	return <NativeVerifyEmailPage />;
}

function NativeVerifyEmailPage() {
	const code = useAuthLinkCode(true);
	const [state, setState] = useState<'idle' | 'pending' | 'complete' | 'error'>('idle');

	async function completeVerification() {
		if (!code) return;
		setState('pending');
		const result = await verifyEmail(code);
		if (result.error) {
			trackAuthError('email_verification', result.error);
			setState('error');
		} else {
			trackAuthSuccess('email_verification');
			setState('complete');
		}
	}

	if (code === undefined) return null;
	if (!code || state === 'error') {
		return (
			<>
				<AuthHeader title={m.auth_invalid_verification_link()} />
				<InlineAlert variant='danger'>{m.auth_verification_invalid()}</InlineAlert>
				<AuthFooter>
					<Link className='link-text font-medium text-foreground' to='/auth'>
						{m.auth_continue_sign_in()}
					</Link>
				</AuthFooter>
			</>
		);
	}
	if (state === 'complete') {
		return (
			<>
				<AuthHeader title={m.auth_email_verified()} />
				<InlineAlert variant='success'>{m.auth_email_confirmed()}</InlineAlert>
				<AuthFooter>
					<Link className='link-text font-medium text-foreground' to='/dashboard'>
						{m.auth_go_dashboard()}
					</Link>
				</AuthFooter>
			</>
		);
	}

	return (
		<>
			<AuthHeader
				title={m.auth_verify_email_title()}
				description={m.auth_verify_email_description()}
			/>
			<Button disabled={state === 'pending'} onClick={completeVerification} size='lg'>
				{state === 'pending' ? m.auth_verifying_email() : m.auth_verify_email_action()}
			</Button>
		</>
	);
}
