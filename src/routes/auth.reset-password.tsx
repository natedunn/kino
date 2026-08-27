'use client';

import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';

import { AuthField, AuthFooter, AuthHeader } from '@/components/auth/auth-card';
import { InlineAlert } from '@/components/inline-alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trackAuthError, trackAuthSuccess } from '@/lib/auth-analytics';
import { authClient } from '@/lib/convex/auth-client';
import { titleMeta } from '@/lib/seo';
import { m } from '@/paraglide/messages.js';

export const Route = createFileRoute('/auth/reset-password')({
	head: () => ({ meta: [titleMeta([m.auth_set_password_meta()])] }),
	validateSearch: (search: Record<string, unknown>): { token?: string; error?: string } => ({
		...(typeof search.token === 'string' ? { token: search.token } : {}),
		...(typeof search.error === 'string' ? { error: search.error } : {}),
	}),
	component: ResetPasswordPage,
});

function ResetPasswordPage() {
	const { token, error: tokenError } = Route.useSearch();
	const navigate = useNavigate();
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(false);

	const passwordsMatch = password === confirmPassword;
	const showPasswordMismatch = confirmPassword.length > 0 && !passwordsMatch;

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!token) return;
		if (!passwordsMatch) {
			setError(m.auth_password_mismatch());
			return;
		}
		setError(null);
		setPending(true);
		try {
			const res = await authClient.resetPassword({
				newPassword: password,
				token,
			});
			if (res.error) {
				trackAuthError('password_reset', res.error);
				setError(m.auth_reset_failed());
			} else {
				trackAuthSuccess('password_reset');
				setDone(true);
				setTimeout(() => navigate({ to: '/auth' }), 1500);
			}
		} catch (err) {
			trackAuthError('password_reset', err);
			setError(m.common_something_went_wrong());
		} finally {
			setPending(false);
		}
	}

	if (!token || tokenError) {
		return (
			<>
				<AuthHeader
					title={m.auth_invalid_reset_title()}
					description={m.auth_invalid_reset_description()}
				/>
				<InlineAlert variant='danger'>{m.auth_request_fresh_reset()}</InlineAlert>
				<AuthFooter>
					<Link className='link-text font-medium text-foreground' to='/auth/forgot-password'>
						{m.auth_request_new_link()}
					</Link>
				</AuthFooter>
			</>
		);
	}

	return (
		<>
			<AuthHeader
				title={m.auth_set_password_title()}
				description={m.auth_set_password_description()}
			/>
			{done ? (
				<InlineAlert variant='success'>{m.auth_password_updated()}</InlineAlert>
			) : (
				<form className='flex flex-col gap-4' onSubmit={onSubmit}>
					<AuthField id='password' label={m.auth_new_password()}>
						<Input
							size='lg'
							autoComplete='new-password'
							id='password'
							minLength={8}
							onChange={(e) => setPassword(e.target.value)}
							required
							type='password'
							value={password}
						/>
					</AuthField>
					<AuthField id='confirm-password' label={m.auth_confirm_new_password()}>
						<Input
							size='lg'
							aria-invalid={showPasswordMismatch}
							autoComplete='new-password'
							id='confirm-password'
							minLength={8}
							onChange={(e) => setConfirmPassword(e.target.value)}
							required
							type='password'
							value={confirmPassword}
						/>
						{showPasswordMismatch ? (
							<p className='text-xs text-destructive'>{m.auth_password_mismatch()}</p>
						) : null}
					</AuthField>
					{error ? <InlineAlert variant='danger'>{error}</InlineAlert> : null}
					<Button
						disabled={
							pending || password.length === 0 || confirmPassword.length === 0 || !passwordsMatch
						}
						size='lg'
						type='submit'
					>
						{pending ? m.auth_updating() : m.auth_update_password()}
					</Button>
				</form>
			)}
		</>
	);
}
