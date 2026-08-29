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

import { getVerifyEmailCallbackUrl } from './auth';

export const Route = createFileRoute('/auth/sign-up')({
	head: () => ({ meta: [titleMeta([m.auth_create_account_meta()])] }),
	validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
		typeof search.redirect === 'string' ? { redirect: search.redirect } : {},
	component: SignUpPage,
});

function SignUpPage() {
	const { redirect } = Route.useSearch();
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [confirmEmail, setConfirmEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(false);

	const emailsMatch = email.trim().toLowerCase() === confirmEmail.trim().toLowerCase();
	const passwordsMatch = password === confirmPassword;
	const showEmailMismatch = confirmEmail.length > 0 && !emailsMatch;
	const showPasswordMismatch = confirmPassword.length > 0 && !passwordsMatch;

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!emailsMatch) {
			setError(m.auth_email_mismatch());
			return;
		}
		if (!passwordsMatch) {
			setError(m.auth_password_mismatch());
			return;
		}
		setError(null);
		setPending(true);
		try {
			const res = await authClient.signUp.email({
				name,
				email,
				password,
				callbackURL: getVerifyEmailCallbackUrl(window.location.origin, redirect),
			});
			if (res.error) {
				trackAuthError('sign_up', res.error);
				setError(m.auth_create_account_failed());
			} else {
				trackAuthSuccess('sign_up');
				setDone(true);
			}
		} catch (err) {
			trackAuthError('sign_up', err);
			setError(m.common_something_went_wrong());
		} finally {
			setPending(false);
		}
	}

	if (done) {
		return (
			<>
				<AuthHeader
					title={m.auth_verify_email_title()}
					description={m.auth_verify_email_description()}
				/>
				<InlineAlert variant='success'>{m.auth_verify_email_sent({ email })}</InlineAlert>
				<AuthFooter>
					<Link className='link-text font-medium text-foreground' search={{ redirect }} to='/auth'>
						{m.auth_back_to_sign_in()}
					</Link>
				</AuthFooter>
			</>
		);
	}

	const canSubmit =
		!pending &&
		name.trim().length > 0 &&
		email.length > 0 &&
		confirmEmail.length > 0 &&
		password.length > 0 &&
		confirmPassword.length > 0 &&
		emailsMatch &&
		passwordsMatch;

	return (
		<>
			<AuthHeader
				title={m.auth_create_account_title()}
				description={m.auth_create_account_description()}
			/>
			<form className='flex flex-col gap-4' onSubmit={onSubmit}>
				<AuthField id='name' label={m.auth_name()}>
					<Input
						size='lg'
						autoComplete='name'
						id='name'
						onChange={(e) => setName(e.target.value)}
						required
						value={name}
					/>
				</AuthField>
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
				<AuthField id='confirm-email' label={m.auth_confirm_email()}>
					<Input
						size='lg'
						aria-invalid={showEmailMismatch}
						autoComplete='email'
						id='confirm-email'
						onChange={(e) => setConfirmEmail(e.target.value)}
						required
						type='email'
						value={confirmEmail}
					/>
					{showEmailMismatch ? (
						<p className='text-xs text-destructive'>{m.auth_email_mismatch()}</p>
					) : null}
				</AuthField>
				<AuthField id='password' label={m.common_password()}>
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
				<AuthField id='confirm-password' label={m.auth_confirm_password()}>
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
				<Button disabled={!canSubmit} size='lg' type='submit'>
					{pending ? m.auth_creating_account() : m.auth_create_account_action()}
				</Button>
			</form>
			<AuthFooter>
				{m.auth_have_account()}{' '}
				<Link className='link-text font-medium text-foreground' search={{ redirect }} to='/auth'>
					{m.auth_sign_in_title()}
				</Link>
			</AuthFooter>
		</>
	);
}
