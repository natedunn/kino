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

export const Route = createFileRoute('/auth/forgot-password')({
	head: () => ({ meta: [titleMeta(['Reset password'])] }),
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
				setError(res.error.message ?? 'Could not send the reset email.');
			} else {
				trackAuthSuccess('password_reset_request');
				setSent(true);
			}
		} catch (err) {
			trackAuthError('password_reset_request', err);
			setError(err instanceof Error ? err.message : 'Something went wrong.');
		} finally {
			setPending(false);
		}
	}

	return (
		<>
			<AuthHeader
				title='Reset your password'
				description='We’ll email you a link to choose a new password.'
			/>
			{sent ? (
				<InlineAlert variant='success'>
					If an account exists for {email}, a reset link is on its way.
				</InlineAlert>
			) : (
				<form className='flex flex-col gap-4' onSubmit={onSubmit}>
					<AuthField id='email' label='Email'>
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
						{pending ? 'Sending…' : 'Send reset link'}
					</Button>
				</form>
			)}
			<AuthFooter>
				<Link className='link-text font-medium text-foreground' to='/auth'>
					Back to sign in
				</Link>
			</AuthFooter>
		</>
	);
}
