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

export const Route = createFileRoute('/auth/accept-invitation')({
	head: () => ({ meta: [titleMeta(['Accept invitation'])] }),
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
				<AuthHeader title='Invalid invitation' />
				<InlineAlert variant='danger'>This invitation link is missing or malformed.</InlineAlert>
			</>
		);
	}

	if (session.isPending) {
		return (
			<>
				<AuthHeader title='Accept your invitation' description='Checking your account…' />
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
					title='Accept your invitation'
					description='Sign in or create an account to join this organization.'
				/>
				<InlineAlert variant='info'>
					You were invited to an organization on Kino. Sign in with the email the invite was sent
					to.
				</InlineAlert>
				<AuthFooter>
					<Link
						className='link-text font-medium text-foreground'
						to='/auth'
						search={{ redirect: back }}
					>
						Continue to sign in
					</Link>
				</AuthFooter>
			</>
		);
	}

	if (invitationState.isPending) {
		return (
			<>
				<AuthHeader title='Accept your invitation' description='Checking your invitation…' />
				<div className='h-24 animate-pulse rounded-xl border bg-muted/30' />
			</>
		);
	}

	const state = invitationState.data?.state;
	if (
		invitationState.isError ||
		!state ||
		state === 'unavailable' ||
		state === 'wrong_account'
	) {
		return (
			<>
				<AuthHeader title='Invalid invitation link' />
				<InlineAlert variant='danger'>
					This invitation is invalid, expired, or no longer available.
				</InlineAlert>
				<AuthFooter>
					<Link className='link-text font-medium text-foreground' to='/dashboard'>
						Go to dashboard
					</Link>
				</AuthFooter>
			</>
		);
	}

	if (state === 'already_accepted') {
		return (
			<>
				<AuthHeader title='Invitation already accepted' />
				<InlineAlert variant='success'>You’ve already joined this organization.</InlineAlert>
				<AuthFooter>
					<Link className='link-text font-medium text-foreground' to='/dashboard'>
						Go to dashboard
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
			setError(err instanceof Error ? err.message : 'Something went wrong.');
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
			setError(err instanceof Error ? err.message : 'Something went wrong.');
		} finally {
			setPending(false);
		}
	}

	return (
		<>
			<AuthHeader title='Accept your invitation' description='Join this organization on Kino.' />
			{accepted ? (
				<InlineAlert variant='success'>You’ve joined the organization. Redirecting…</InlineAlert>
			) : (
				<div className='flex flex-col gap-4'>
					{error ? <InlineAlert variant='danger'>{error}</InlineAlert> : null}
					<Button disabled={pending} onClick={onAccept} size='lg' type='button'>
						{pending ? 'Joining…' : 'Accept invitation'}
					</Button>
					<Button disabled={pending} onClick={onReject} size='lg' type='button' variant='outline'>
						Decline
					</Button>
				</div>
			)}
			<AuthFooter>
				<Link className='link-text font-medium text-foreground' to='/dashboard'>
					Go to dashboard
				</Link>
			</AuthFooter>
		</>
	);
}
