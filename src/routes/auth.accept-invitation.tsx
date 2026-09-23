'use client';

import type { Id } from '../../convex/native/_generated/dataModel';

import { useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation as useConvexMutation } from 'convex/react';

import { AuthFooter, AuthHeader } from '@/components/auth/auth-card';
import { InlineAlert } from '@/components/inline-alert';
import { Button } from '@/components/ui/button';
import { trackAuthError, trackAuthSuccess } from '@/lib/auth-analytics';
import { useAuthSession } from '@/lib/auth/auth-client';
import { titleMeta } from '@/lib/seo';
import * as m from '@/paraglide/messages.js';

import { api as nativeApi } from '../../convex/native/_generated/api';

export const Route = createFileRoute('/auth/accept-invitation')({
	head: () => ({ meta: [titleMeta([m.auth_accept_invitation_meta()])] }),
	validateSearch: (search: Record<string, unknown>): { invitationId?: string } =>
		typeof search.invitationId === 'string' ? { invitationId: search.invitationId } : {},
	component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
	return <NativeAcceptInvitationPage />;
}

function NativeAcceptInvitationPage() {
	const { invitationId } = Route.useSearch();
	const [inspectionTime] = useState(() => Date.now());
	const session = useAuthSession();
	const navigate = useNavigate();
	const acceptInvitation = useConvexMutation(nativeApi.invitations.accept);
	const rejectInvitation = useConvexMutation(nativeApi.invitations.reject);
	const invitationState = useQuery({
		...convexQuery(nativeApi.invitations.inspect, {
			invitationId: invitationId as Id<'invitations'>,
			now: inspectionTime,
		}),
		enabled: !!invitationId && !!session.user,
		retry: false,
	});
	const [pending, setPending] = useState(false);
	const [error, setError] = useState(false);
	const [accepted, setAccepted] = useState(false);

	if (!invitationId) {
		return (
			<>
				<AuthHeader title={m.auth_invalid_invitation()} />
				<InlineAlert variant='danger'>{m.auth_invitation_missing()}</InlineAlert>
			</>
		);
	}
	if (session.isPending) {
		return (
			<>
				<AuthHeader
					title={m.auth_accept_invitation_title()}
					description={m.auth_checking_account()}
				/>
				<div className='h-24 animate-pulse rounded-xl border bg-muted/30' />
			</>
		);
	}
	if (!session.user) {
		const back = `/auth/accept-invitation?invitationId=${encodeURIComponent(invitationId)}`;
		return (
			<>
				<AuthHeader
					title={m.auth_accept_invitation_title()}
					description={m.auth_invitation_sign_in_description()}
				/>
				<InlineAlert variant='info'>{m.auth_invitation_sign_in_notice()}</InlineAlert>
				<AuthFooter>
					<Link
						className='link-text font-medium text-foreground'
						to='/auth'
						search={{ redirect: back }}
					>
						{m.auth_continue_sign_in()}
					</Link>
				</AuthFooter>
			</>
		);
	}
	if (invitationState.isPending) {
		return (
			<>
				<AuthHeader
					title={m.auth_accept_invitation_title()}
					description={m.auth_checking_invitation()}
				/>
				<div className='h-24 animate-pulse rounded-xl border bg-muted/30' />
			</>
		);
	}
	const state = invitationState.data?.state;
	if (invitationState.isError || !state || state === 'unavailable' || state === 'wrong_account') {
		return (
			<>
				<AuthHeader title={m.auth_invalid_invitation_link()} />
				<InlineAlert variant='danger'>{m.auth_invitation_unavailable()}</InlineAlert>
				<AuthFooter>
					<Link className='link-text font-medium text-foreground' to='/dashboard'>
						{m.auth_go_dashboard()}
					</Link>
				</AuthFooter>
			</>
		);
	}
	if (state === 'already_accepted') {
		return (
			<>
				<AuthHeader title={m.auth_invitation_accepted_title()} />
				<InlineAlert variant='success'>{m.auth_invitation_already_joined()}</InlineAlert>
				<AuthFooter>
					<Link
						className='link-text font-medium text-foreground'
						params={{ org: invitationState.data.organizationSlug }}
						to='/@{$org}'
					>
						{m.auth_go_dashboard()}
					</Link>
				</AuthFooter>
			</>
		);
	}

	return (
		<>
			<AuthHeader
				title={m.auth_accept_invitation_title()}
				description={m.auth_invitation_join_description()}
			/>
			{accepted ? (
				<InlineAlert variant='success'>{m.auth_invitation_joined()}</InlineAlert>
			) : (
				<div className='flex flex-col gap-4'>
					{error ? <InlineAlert variant='danger'>{m.auth_something_wrong()}</InlineAlert> : null}
					<Button
						disabled={pending}
						onClick={() => {
							setPending(true);
							setError(false);
							void acceptInvitation({ invitationId: invitationId as Id<'invitations'> })
								.then((result) => {
									trackAuthSuccess('invitation_accept');
									setAccepted(true);
									setTimeout(() => {
										void navigate({ params: { org: result.organizationSlug }, to: '/@{$org}' });
									}, 1200);
								})
								.catch((cause) => {
									trackAuthError('invitation_accept', cause);
									setError(true);
								})
								.finally(() => setPending(false));
						}}
						size='lg'
						type='button'
					>
						{pending ? m.auth_joining() : m.auth_accept_invitation_action()}
					</Button>
					<Button
						disabled={pending}
						onClick={() => {
							setPending(true);
							setError(false);
							void rejectInvitation({ invitationId: invitationId as Id<'invitations'> })
								.then(() => navigate({ to: '/dashboard' }))
								.catch(() => setError(true))
								.finally(() => setPending(false));
						}}
						size='lg'
						type='button'
						variant='outline'
					>
						{m.auth_decline()}
					</Button>
				</div>
			)}
		</>
	);
}
