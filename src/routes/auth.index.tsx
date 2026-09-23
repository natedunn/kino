'use client';

import { useEffect, useRef, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';

import { AuthField, AuthFooter, AuthHeader } from '@/components/auth/auth-card';
import { InlineAlert } from '@/components/inline-alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Discord from '@/icons/discord';
import Github from '@/icons/github';
import Google from '@/icons/google';
import LoaderQuarter from '@/icons/loader-quarter';
import { trackAuthError, trackAuthStarted, trackAuthSuccess } from '@/lib/auth-analytics';
import {
	resendVerificationEmail,
	signInWithGitHub,
	signInWithPassword,
	useAuthSession,
	useIsAuthenticated,
} from '@/lib/auth/auth-client';
import { isNativeGithubEnabled } from '@/lib/auth/runtime';
import { endSignOut, isSigningOut } from '@/lib/auth/sign-out-state';
import { m } from '@/paraglide/messages.js';

import { getSafeRedirectTarget, getVerifyEmailCallbackUrl } from './auth';

export const Route = createFileRoute('/auth/')({
	validateSearch: (
		search: Record<string, unknown>
	): { error?: string; oauthError?: string; redirect?: string; verified?: boolean } => ({
		...(typeof search.error === 'string' ? { error: search.error } : {}),
		...(typeof search.oauthError === 'string' ? { oauthError: search.oauthError } : {}),
		...(typeof search.redirect === 'string' ? { redirect: search.redirect } : {}),
		...(search.verified === '1' ? { verified: true } : {}),
	}),
	component: SignInPage,
});

function SignInPage() {
	const { error: verificationError, oauthError, redirect, verified } = Route.useSearch();
	const session = useAuthSession();
	// Server-verified auth. This flips to `false` synchronously the moment a
	// sign-out begins (kitcn clears the auth store before the network round-trip),
	// so gating the redirect on it — rather than the longer-lived Better Auth
	// session — keeps a just-signed-out user on /auth instead of bouncing them
	// back into the app while the session cookie is still being cleared.
	const isAuthed = useIsAuthenticated();
	const redirectTarget = getSafeRedirectTarget(redirect);
	// The redirect navigates away; guard so it only ever fires once even if the
	// effect re-runs or an explicit sign-in success also triggers it.
	const redirectingRef = useRef(false);

	async function goToRedirect() {
		if (redirectingRef.current) return;
		redirectingRef.current = true;
		// The sign-in response adopts the access token client-side and commits the
		// refresh token through an HttpOnly Start cookie. A document navigation
		// makes that cookie the source of truth for the protected SSR request.
		window.location.replace(redirectTarget);
	}

	// Already-authenticated visitor landed on /auth — bounce them into the app.
	// While a sign-out is settling, client auth state transiently still reads as
	// authenticated, so suppress the redirect until the Better Auth session is
	// genuinely gone (at which point we also lift the sign-out suppression).
	useEffect(() => {
		if (!session.user) {
			endSignOut();
			return;
		}
		if (isAuthed && !isSigningOut()) {
			void goToRedirect();
		}
		// `goToRedirect` is re-created each render; the redirect intent depends on
		// auth state only (see comment above), so it's deliberately excluded.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isAuthed, session.user]);

	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	// Which action is mid-flight. On success a page navigation follows, so we keep
	// the spinner up (don't clear it); we only clear on error so the user can retry.
	const [submitting, setSubmitting] = useState<'github' | 'password' | null>(null);
	const [error, setError] = useState<string | null>(null);
	// Set when sign-in is rejected because the email isn't verified yet. We then
	// offer a one-click resend instead of a dead-end error.
	const [needsVerification, setNeedsVerification] = useState(false);
	const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');
	const busy = submitting !== null;

	async function onResendVerification() {
		setError(null);
		setResendState('sending');
		try {
			const result = await resendVerificationEmail({
				email,
				callbackURL: getVerifyEmailCallbackUrl(window.location.origin, redirectTarget),
			});
			if (result.error) throw result.error;
			trackAuthSuccess('email_verification', { method: 'resend' });
			setResendState('sent');
		} catch (err) {
			trackAuthError('email_verification', err, { method: 'resend' });
			setResendState('idle');
			setError(m.auth_resend_failed());
		}
	}

	function callbackURL() {
		return new URL(redirectTarget, window.location.origin).toString();
	}

	async function onGithub() {
		setError(null);
		setSubmitting('github');
		// OAuth completes after a redirect off this page, so we can only observe the
		// start and any immediate error here.
		trackAuthStarted('sign_in', { method: 'github' });
		try {
			const res = await signInWithGitHub(callbackURL());
			// Success initiates an OAuth redirect — leave the spinner up.
			if (res.error) {
				trackAuthError('sign_in', res.error, { method: 'github' });
				setError(m.auth_github_failed());
				setSubmitting(null);
			}
		} catch (err) {
			trackAuthError('sign_in', err, { method: 'github' });
			setError(m.common_something_went_wrong());
			setSubmitting(null);
		}
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setNeedsVerification(false);
		setResendState('idle');
		setSubmitting('password');
		try {
			const res = await signInWithPassword({
				email,
				password,
				callbackURL: callbackURL(),
			});
			if (res.error) {
				trackAuthError('sign_in', res.error, { method: 'password' });
				// Email-and-password accounts must verify before they can sign in
				// (requireEmailVerification). Surface a resend affordance rather than a
				// dead-end error.
				if (res.error.code === 'EMAIL_NOT_VERIFIED' || res.error.status === 403) {
					setNeedsVerification(true);
				} else if (res.error.code === 'RATE_LIMITED') {
					setError(m.server_error_rate_limited());
				} else {
					setError(m.auth_sign_in_failed());
				}
				setSubmitting(null);
			} else {
				trackAuthSuccess('sign_in', { method: 'password' });
				// SPA-navigate (keep the spinner up through the transition) instead of
				// a full-page reload — see `goToRedirect`.
				await goToRedirect();
			}
		} catch (err) {
			trackAuthError('sign_in', err, { method: 'password' });
			setError(m.common_something_went_wrong());
			setSubmitting(null);
		}
	}

	// Session is live and we're authenticated (or mid sign-in) but the redirect
	// hasn't completed yet — show a spinner instead of an empty card. Copy
	// reflects whether a sign-in is actually in flight (just signed in) vs. an
	// already-authenticated visitor being bounced. The `isAuthed || busy` gate
	// means a *just-signed-out* visitor (whose Better Auth session lingers for a
	// moment while the cookie clears) sees the sign-in form, not a stuck spinner —
	// as does `!isSigningOut()`, which covers the window where auth state
	// transiently re-reads as authenticated mid sign-out.
	if (session.user && (isAuthed || busy) && !isSigningOut()) {
		return (
			<div className='flex flex-col items-center justify-center gap-3 py-6 text-muted-foreground'>
				<LoaderQuarter className='size-6 animate-spin' />
				<p className='text-sm'>{busy ? m.auth_signing_in() : m.auth_redirecting()}</p>
			</div>
		);
	}

	return (
		<>
			<AuthHeader title={m.auth_sign_in_title()} description={m.auth_sign_in_description()} />
			<div className='flex flex-col gap-4'>
				<div className='flex flex-col gap-2'>
					<Button
						disabled={busy || !isNativeGithubEnabled}
						onClick={onGithub}
						size='lg'
						title={!isNativeGithubEnabled ? m.auth_coming_soon() : undefined}
						type='button'
						variant='outline'
					>
						{submitting === 'github' ? <LoaderQuarter className='animate-spin' /> : <Github />}
						{m.auth_continue_github()}
					</Button>
					{/* Disabled for now — wired up later. */}
					<div className='grid grid-cols-2 gap-2'>
						<Button disabled size='lg' title={m.auth_coming_soon()} type='button' variant='outline'>
							<Google />
							Google
						</Button>
						<Button disabled size='lg' title={m.auth_coming_soon()} type='button' variant='outline'>
							<Discord />
							Discord
						</Button>
					</div>
				</div>

				<div className='flex items-center gap-3 text-xs text-muted-foreground'>
					<div className='h-px flex-1 bg-border' />
					<span>{m.auth_or()}</span>
					<div className='h-px flex-1 bg-border' />
				</div>

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

					<AuthField id='password' label={m.common_password()}>
						<Input
							size='lg'
							autoComplete='current-password'
							id='password'
							onChange={(e) => setPassword(e.target.value)}
							required
							type='password'
							value={password}
						/>
					</AuthField>

					{error ? <InlineAlert variant='danger'>{error}</InlineAlert> : null}

					{verified && !verificationError ? (
						<InlineAlert variant='success'>{m.auth_email_confirmed()}</InlineAlert>
					) : null}

					{verificationError ? (
						<InlineAlert variant='danger'>{m.auth_verification_expired()}</InlineAlert>
					) : null}

					{oauthError ? <InlineAlert variant='danger'>{m.auth_github_failed()}</InlineAlert> : null}

					{needsVerification ? (
						<InlineAlert variant='warning'>
							{resendState === 'sent' ? (
								<>{m.auth_verification_sent({ email })}</>
							) : (
								<div className='flex flex-col gap-2'>
									<span>{m.auth_email_not_verified()}</span>
									<Button
										disabled={resendState === 'sending'}
										onClick={onResendVerification}
										size='sm'
										type='button'
										variant='outline'
									>
										{resendState === 'sending' ? m.auth_sending() : m.auth_resend_verification()}
									</Button>
								</div>
							)}
						</InlineAlert>
					) : null}

					{!needsVerification ? (
						resendState === 'sent' ? (
							<InlineAlert variant='success'>{m.auth_verification_sent({ email })}</InlineAlert>
						) : (
							<Button
								disabled={busy || resendState === 'sending' || email.trim().length === 0}
								onClick={onResendVerification}
								size='sm'
								type='button'
								variant='ghost'
							>
								{resendState === 'sending' ? m.auth_sending() : m.auth_resend_verification()}
							</Button>
						)
					) : null}

					<Button disabled={busy} size='lg' type='submit'>
						{submitting === 'password' ? (
							<>
								<LoaderQuarter className='animate-spin' />
								{m.auth_signing_in()}
							</>
						) : (
							m.auth_sign_in_title()
						)}
					</Button>

					<Link
						className='link-text text-center text-sm text-muted-foreground'
						to='/auth/forgot-password'
					>
						{m.auth_forgot_password()}
					</Link>
				</form>
			</div>
			<AuthFooter>
				{m.auth_no_account()}{' '}
				<Link
					className='link-text font-medium text-foreground'
					search={{ redirect }}
					to='/auth/sign-up'
				>
					{m.auth_create_one()}
				</Link>
			</AuthFooter>
		</>
	);
}
