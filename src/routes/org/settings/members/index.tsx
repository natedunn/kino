import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';

import { SettingsSkeleton } from '../-components/settings-skeleton';
import { useDelayedFlag } from '../-components/use-delayed-flag';
import { useSettingsOrgSlug } from '../-components/use-settings-org';
import { InlineAlert } from '@/components/inline-alert';
import { EmptyState } from '@/components/kino/common';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { titleMeta } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { FORM_LIMITS, emailSchema } from '@/lib/validation';


export const Route = createFileRoute('/org/settings/members/')({
	head: () => ({
		meta: [titleMeta(['Members'])],
	}),
	loader: async ({ context, location }) => {
		const orgSlug = (location.search as { org?: string }).org;
		if (!context.loaderToken || !orgSlug) return;
		const orgData = await context.queryClient.ensureQueryData(
			crpcServer.org.getDetails.queryOptions({ slug: orgSlug }, { skipUnauth: true })
		);
		// Managing members is edit-only. Bounce non-editors before render; the
		// component still enforces the finer `canManage` distinction.
		if (!orgData?.permissions.canEdit) {
			throw redirect({ to: '/dashboard' });
		}
		void context.queryClient.ensureQueryData(
			crpcServer.orgMember.listMembers.queryOptions({ slug: orgSlug })
		);
		void context.queryClient.ensureQueryData(
			crpcServer.orgMember.listPendingInvitations.queryOptions({
				slug: orgSlug,
			})
		);
	},
	component: MembersSettingsRoute,
});

const ASSIGNABLE_ROLES = ['admin', 'editor'] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

function mutationErrorMessage(error: unknown) {
	if (!error) return null;
	const anyError = error as { data?: { message?: string }; message?: string };
	return anyError.data?.message ?? anyError.message ?? 'Something went wrong';
}

function MembersSettingsRoute() {
	const orgSlug = useSettingsOrgSlug();
	const crpc = useCRPC();

	const orgQuery = useQuery(
		crpc.org.getDetails.queryOptions(
			{ slug: orgSlug ?? '' },
			{ enabled: !!orgSlug, skipUnauth: true }
		)
	);
	const membersQuery = useQuery(
		crpc.orgMember.listMembers.queryOptions({ slug: orgSlug ?? '' }, { enabled: !!orgSlug })
	);
	const pendingQuery = useQuery(
		crpc.orgMember.listPendingInvitations.queryOptions(
			{ slug: orgSlug ?? '' },
			{ enabled: !!orgSlug }
		)
	);

	const invite = useMutation(crpc.orgMember.inviteMember.mutationOptions());
	const updateRole = useMutation(crpc.orgMember.updateMemberRole.mutationOptions());
	const removeMember = useMutation(crpc.orgMember.removeMember.mutationOptions());
	const cancelInvite = useMutation(crpc.orgMember.cancelInvitation.mutationOptions());

	const [email, setEmail] = useState('');
	const [inviteRole, setInviteRole] = useState<AssignableRole>('editor');
	const [formError, setFormError] = useState<string | null>(null);

	const data = membersQuery.data;
	const organizationId = orgQuery.data?.org?.id;

	const isLoading = !orgSlug || membersQuery.isLoading || orgQuery.isLoading;
	const showSkeleton = useDelayedFlag(isLoading);
	if (isLoading) {
		return showSkeleton ? <SettingsSkeleton /> : null;
	}

	if (!data || !organizationId) {
		return (
			<EmptyState
				title='Members unavailable'
				description='This organization either does not exist or your session cannot view it.'
			/>
		);
	}

	if (!data.canManage) {
		return (
			<EmptyState
				title='Member management unavailable'
				description='Only organization admins and owners can manage members.'
			/>
		);
	}

	const actionError =
		mutationErrorMessage(invite.error) ??
		mutationErrorMessage(updateRole.error) ??
		mutationErrorMessage(removeMember.error) ??
		mutationErrorMessage(cancelInvite.error);

	return (
		<section className='max-w-3xl'>
			<header className='border-b pb-4'>
				<h2 className='text-xl font-semibold'>Members</h2>
				<p className='mt-1 text-sm text-muted-foreground'>
					Invite the team that runs this organization. Admins manage settings and members; editors
					can create and edit content. Both cascade to every project in the org. Anyone with a Kino
					account can already participate in your public projects without being a member here.
				</p>
			</header>

			{/* Invite */}
			<form
				className='mt-6 flex flex-col gap-3 rounded-xl border bg-card p-6 sm:flex-row sm:items-end'
				onSubmit={(event) => {
					event.preventDefault();
					setFormError(null);
					const parsed = emailSchema.safeParse(email);
					if (!parsed.success) {
						setFormError(parsed.error.issues[0]?.message ?? 'Invalid email');
						return;
					}
					invite.mutate(
						{
							email: parsed.data,
							organizationId,
							role: inviteRole,
						},
						{ onSuccess: () => setEmail('') }
					);
				}}
			>
				<div className='flex flex-1 flex-col gap-2'>
					<label className='text-sm font-medium' htmlFor='invite-email'>
						Invite by email
					</label>
					<Input
						autoCapitalize='none'
						autoComplete='email'
						id='invite-email'
						inputMode='email'
						maxLength={FORM_LIMITS.email}
						onChange={(event) => setEmail(event.target.value)}
						placeholder='teammate@example.com'
						spellCheck={false}
						type='email'
						value={email}
					/>
				</div>
				<div className='flex flex-col gap-2'>
					<label className='text-sm font-medium' htmlFor='invite-role'>
						Role
					</label>
					<RoleSelect
						id='invite-role'
						value={inviteRole}
						onChange={(value) => setInviteRole(value)}
					/>
				</div>
				<Button type='submit' disabled={invite.isPending || !email.trim()}>
					{invite.isPending ? 'Inviting...' : 'Send invite'}
				</Button>
			</form>

			{(formError ?? actionError) ? (
				<div className='mt-4'>
					<InlineAlert variant='danger'>{formError ?? actionError}</InlineAlert>
				</div>
			) : null}

			{/* Members */}
			<div className='mt-8'>
				<h3 className='text-sm font-bold text-muted-foreground'>
					{data.members.length} member{data.members.length === 1 ? '' : 's'}
				</h3>
				<div className='mt-3 flex flex-col divide-y rounded-xl border bg-card'>
					{data.members.map((member) => {
						const isOwner = member.role === 'owner';
						return (
							<div key={member.id} className='flex items-center gap-3 px-4 py-3'>
								<Avatar className='size-8 shrink-0'>
									{member.user.image ? <AvatarImage src={member.user.image} /> : null}
									<AvatarFallback className='text-xs font-semibold'>
										{member.user.name[0].toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<div className='min-w-0 flex-1'>
									<p className='truncate text-sm font-medium'>
										{member.user.name}
									</p>
									<p className='truncate text-xs text-muted-foreground'>{member.user.email}</p>
								</div>
								{isOwner ? (
									<Badge variant='outline' className='shrink-0 capitalize'>
										Owner
									</Badge>
								) : (
									<>
										<RoleSelect
											value={member.role as AssignableRole}
											disabled={updateRole.isPending}
											onChange={(value) =>
												updateRole.mutate({
													memberId: member.id,
													role: value,
												})
											}
										/>
										<Button
											type='button'
											variant='ghost'
											size='sm'
											className='shrink-0 text-muted-foreground hover:text-destructive'
											disabled={removeMember.isPending}
											onClick={() => {
												if (
													window.confirm(
														`Remove ${member.user.name} from this organization?`
													)
												) {
													removeMember.mutate({ memberId: member.id });
												}
											}}
										>
											<Trash2 className='size-4' />
											<span className='sr-only'>Remove member</span>
										</Button>
									</>
								)}
							</div>
						);
					})}
				</div>
			</div>

			{/* Pending invitations */}
			{pendingQuery.data && pendingQuery.data.length > 0 ? (
				<div className='mt-8'>
					<h3 className='text-sm font-bold text-muted-foreground'>Pending invitations</h3>
					<div className='mt-3 flex flex-col divide-y rounded-xl border bg-card'>
						{pendingQuery.data.map((inv) => (
							<div key={inv.id} className='flex items-center gap-3 px-4 py-3'>
								<div className='min-w-0 flex-1'>
									<p className='truncate text-sm font-medium'>{inv.email}</p>
									<p className='text-xs text-muted-foreground capitalize'>{inv.role}</p>
								</div>
								<Button
									type='button'
									variant='ghost'
									size='sm'
									disabled={cancelInvite.isPending}
									onClick={() => cancelInvite.mutate({ invitationId: inv.id })}
								>
									Cancel
								</Button>
							</div>
						))}
					</div>
					<p className='mt-2 text-xs text-muted-foreground'>
						Invitations are created but email delivery isn’t configured yet — share the invite link
						manually for now.
					</p>
				</div>
			) : null}
		</section>
	);
}

function RoleSelect({
	id,
	value,
	onChange,
	disabled,
}: {
	id?: string;
	value: AssignableRole;
	onChange: (value: AssignableRole) => void;
	disabled?: boolean;
}) {
	return (
		<select
			id={id}
			value={value}
			disabled={disabled}
			onChange={(event) => onChange(event.target.value as AssignableRole)}
			className={cn(
				'h-9 shrink-0 rounded-md border border-input bg-background px-3 text-sm capitalize',
				'focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
				disabled && 'opacity-50'
			)}
		>
			{ASSIGNABLE_ROLES.map((role) => (
				<option key={role} value={role} className='capitalize'>
					{role}
				</option>
			))}
		</select>
	);
}
