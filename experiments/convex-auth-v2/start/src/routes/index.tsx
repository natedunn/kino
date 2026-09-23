import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ConvexHttpClient } from 'convex/browser';

import { api } from '../../../email/convex/_generated/api';
import { announceSessionChange } from '../session-sync';

export const Route = createFileRoute('/')({ component: Login });
function Login() {
	const [error, setError] = useState('');
	return (
		<main>
			<h1>Start cookie-session proof</h1>
			<form
				method='post'
				onSubmit={async (e) => {
					e.preventDefault();
					const data = new FormData(e.currentTarget);
					try {
						const proxy = new ConvexHttpClient('/api/auth/signin?path=', {
							skipConvexDeploymentUrlCheck: true,
						});
						const result = await proxy.mutation(api.auth.signIn, {
							email: String(data.get('email')),
							password: String(data.get('password')),
						});
						if (result.status === 'complete') {
							announceSessionChange();
							const invitationId = new URLSearchParams(location.search).get('invitationId');
							location.assign(
								invitationId
									? '/auth/accept-invitation?invitationId=' + encodeURIComponent(invitationId)
									: '/private/alpha'
							);
						} else setError('Sign-in refused');
					} catch {
						setError('Sign-in failed');
					}
				}}
			>
				<label>
					Email
					<input name='email' type='email' required />
				</label>
				<label>
					Password
					<input name='password' type='password' required />
				</label>
				<button>Sign in</button>
			</form>
			<button
				type='button'
				onClick={async () => {
					try {
						const invitationId = new URLSearchParams(location.search).get('invitationId');
						if (invitationId) sessionStorage.setItem('proofInvitationId', invitationId);
						const response = await fetch('/api/auth/github/start', { method: 'POST' });
						if (!response.ok) throw new Error();
						const flow = await response.json();
						location.assign(flow.redirect);
					} catch {
						setError('GitHub sign-in failed');
					}
				}}
			>
				Continue with GitHub
			</button>
			<p role='status'>{error}</p>
		</main>
	);
}
