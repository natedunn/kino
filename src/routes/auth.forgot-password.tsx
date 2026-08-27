'use client';

import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';

import { AuthField, AuthFooter, AuthHeader } from '@/components/auth/auth-card';
import { InlineAlert } from '@/components/inline-alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trackAuthError, trackAuthSuccess } from '@/lib/auth-analytics';
import { authClient } from '@/lib/convex/auth-client';
import { titleMeta } from '@/lib/seo';
import { m } from '@/paraglide/messages.js';

export const Route = createFileRoute('/auth/forgot-password')({
	head: () => ({ meta: [titleMeta([m.auth_reset_password_meta()])] }),
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const [email, setEmail] = useState('');
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [sent, setSent] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setPending(true);
		try {
			const res = await authClient.requestPasswordReset({
				email,
				redirectTo: new URL('/auth/reset-password', window.location.origin).toString(),
			});
			if (res.error) {
				trackAuthError('password_reset_request', res.error);
				setError(m.auth_reset_email_failed());
			} else {
				trackAuthSuccess('password_reset_request');
				setSent(true);
			}
		} catch (err) {
			trackAuthError('password_reset_request', err);
			setError(m.common_something_went_wrong());
		} finally {
			setPending(false);
		}
	}

	return (
		<>
			<AuthHeader
				title={m.auth_reset_password_title()}
				description={m.auth_reset_password_description()}
			/>
			{sent ? (
				<InlineAlert variant='success'>{m.auth_reset_email_sent({ email })}</InlineAlert>
			) : (
				<form className='flex flex-col gap-4' onSubmit={onSubmit}>
					<AuthField id='email' label={m.common_email()}>
						<Input
							size='lg'
							autoComplete='email'
							id='email'
							onChange={(e) => setEmail(e.target.value)}
							required
							type='email'
							value={email}
						/>
					</AuthField>
					{error ? <InlineAlert variant='danger'>{error}</InlineAlert> : null}
					<Button disabled={pending} size='lg' type='submit'>
						{pending ? m.auth_sending() : m.auth_send_reset_link()}
					</Button>
				</form>
			)}
			<AuthFooter>
				<Link className='link-text font-medium text-foreground' to='/auth'>
					{m.auth_back_to_sign_in()}
				</Link>
			</AuthFooter>
		</>
	);
}
