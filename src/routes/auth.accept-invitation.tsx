'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';

import { AuthFooter, AuthHeader } from '@/components/auth/auth-card';
import { InlineAlert } from '@/components/inline-alert';
import { Button } from '@/components/ui/button';
import { trackAuthError, trackAuthSuccess } from '@/lib/auth-analytics';
import { authClient } from '@/lib/convex/auth-client';
import { useCRPC } from '@/lib/convex/crpc';
import { titleMeta } from '@/lib/seo';
import * as m from '@/paraglide/messages.js';

export const Route = createFileRoute('/auth/accept-invitation')({
	head: () => ({ meta: [titleMeta([m.auth_accept_invitation_meta()])] }),
	validateSearch: (search: Record<string, unknown>): { invitationId?: string } =>
		typeof search.invitationId === 'string' ? { invitationId: search.invitationId } : {},
	component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
	const { invitationId } = Route.useSearch();
	const session = authClient.useSession();
	const crpc = useCRPC();
	const invitationState = useQuery(
		crpc.orgMember.getInvitationState.queryOptions(
			{ invitationId: invitationId ?? '' },
			{
				enabled: !!invitationId && !!session.data?.user,
				subscribe: false,
			}
		)
	);
	const acceptInvitation = useMutation(crpc.orgMember.acceptInvitation.mutationOptions());
	const rejectInvitation = useMutation(crpc.orgMember.rejectInvitation.mutationOptions());
	const navigate = useNavigate();
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
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

	// Accepting requires an authenticated account. Send the user to sign in and
	// back here.
	if (!session.data?.user) {
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
					<Link className='link-text font-medium text-foreground' to='/dashboard'>
						{m.auth_go_dashboard()}
					</Link>
				</AuthFooter>
			</>
		);
	}

	async function onAccept() {
		setError(null);
		setPending(true);
		try {
			const result = await acceptInvitation.mutateAsync({ invitationId: invitationId! });
			trackAuthSuccess('invitation_accept');
			setAccepted(true);
			setTimeout(() => {
				if (result.organizationSlug) {
					void navigate({
						params: { org: result.organizationSlug },
						to: '/@{$org}',
					});
					return;
				}
				void navigate({ to: '/dashboard' });
			}, 1200);
		} catch (err) {
			trackAuthError('invitation_accept', err);
			setError(err instanceof Error ? err.message : m.auth_something_wrong());
		} finally {
			setPending(false);
		}
	}

	async function onReject() {
		setError(null);
		setPending(true);
		try {
			await rejectInvitation.mutateAsync({ invitationId: invitationId! });
			await navigate({ to: '/dashboard' });
		} catch (err) {
			setError(err instanceof Error ? err.message : m.auth_something_wrong());
		} finally {
			setPending(false);
		}
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
					{error ? <InlineAlert variant='danger'>{error}</InlineAlert> : null}
					<Button disabled={pending} onClick={onAccept} size='lg' type='button'>
						{pending ? m.auth_joining() : m.auth_accept_invitation_action()}
					</Button>
					<Button disabled={pending} onClick={onReject} size='lg' type='button' variant='outline'>
						{m.auth_decline()}
					</Button>
				</div>
			)}
			<AuthFooter>
				<Link className='link-text font-medium text-foreground' to='/dashboard'>
					{m.auth_go_dashboard()}
				</Link>
			</AuthFooter>
		</>
	);
}
