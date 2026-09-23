import type { Id } from '../../../email/convex/_generated/dataModel';

import { useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { makeFunctionReference } from 'convex/server';

const inspect = makeFunctionReference<
	'query',
	{ invitationId: Id<'invitations'> },
	{ organizationName: string; role: string; status: string; expiresAt: number }
>('invitations:inspect');
const accept = makeFunctionReference<
	'mutation',
	{ invitationId: Id<'invitations'> },
	Id<'memberships'>
>('invitations:accept');
export const Route = createFileRoute('/auth/accept-invitation')({
	validateSearch: (search: Record<string, unknown>) => ({
		invitationId: typeof search.invitationId === 'string' ? search.invitationId : '',
	}),
	component: Invitation,
});
function Invitation() {
	const { invitationId } = Route.useSearch();
	const { initialToken } = Route.useRouteContext();
	const [message, setMessage] = useState('');
	const [busy, setBusy] = useState(false);
	const join = useMutation(accept);
	const result = useQuery({
		...convexQuery(inspect, { invitationId: invitationId as Id<'invitations'> }),
		enabled: !!initialToken && !!invitationId,
		retry: false,
	});
	if (!initialToken)
		return (
			<main>
				<h1>Invitation</h1>
				<p>Sign in with the verified email that received this invitation.</p>
				<a href={'/?invitationId=' + encodeURIComponent(invitationId)}>Sign in to accept</a>
			</main>
		);
	return (
		<main>
			<h1>Invitation</h1>
			{result.isError ? (
				<p role='alert'>
					This invitation is unavailable for this account. Sign in with the invited, verified email.
				</p>
			) : result.data ? (
				<>
					<h2>{result.data.organizationName}</h2>
					<p>Role: {result.data.role}</p>
					<p>Status: {result.data.status}</p>
					<button
						disabled={busy || result.data.status !== 'pending'}
						onClick={async () => {
							setBusy(true);
							try {
								await join({ invitationId: invitationId as Id<'invitations'> });
								setMessage('Invitation accepted');
							} catch {
								setMessage(
									'Invitation could not be accepted. It may have expired or been revoked.'
								);
							} finally {
								setBusy(false);
							}
						}}
					>
						Accept invitation
					</button>
				</>
			) : (
				<p>Loading invitation</p>
			)}
			<p role='status'>{message}</p>
			<Link to='/organizations'>Open organizations</Link>
		</main>
	);
}
