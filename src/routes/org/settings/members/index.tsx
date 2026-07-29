import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';

import { InlineAlert } from '@/components/inline-alert';
import { EmptyState } from '@/components/kino/common';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { extractErrorMessage } from '@/lib/errors';
import { titleMeta } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { getInitial } from '@/lib/utils/get-initial';
import { emailSchema, FORM_LIMITS } from '@/lib/validation';

import { SettingsSkeleton } from '../-components/settings-skeleton';
import { useDelayedFlag } from '../-components/use-delayed-flag';
import { useSettingsOrgSlug } from '../-components/use-settings-org';

export const Route = createFileRoute('/org/settings/members/')({
	head: () => ({
		meta: [titleMeta(['Members'])],
	}),
	loader: ({ context, location }) => {
		const orgSlug = (location.search as { org?: string }).org;
		if (!context.loaderToken || !orgSlug) return;
		// Access (canEdit) is gated once on the `/org/settings` layout loader; the
		// component still enforces the finer `canManage` distinction. Here we only
		// warm the page-specific caches.
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

const ASSIGNABLE_ROLES = ['admin', 'moderator'] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

function mutationErrorMessage(error: unknown) {
	if (!error) return null;
	return extractErrorMessage(error);
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
	const projectsQuery = useQuery(
		crpc.project.getManyByOrg.queryOptions(
			{ limit: 100, orgSlug: orgSlug ?? '' },
			{ enabled: !!orgSlug }
		)
	);

	const invite = useMutation(crpc.orgMember.inviteMember.mutationOptions());
	const updateRole = useMutation(crpc.orgMember.updateMemberRole.mutationOptions());
	const removeMember = useMutation(crpc.orgMember.removeMember.mutationOptions());
	const cancelInvite = useMutation(crpc.orgMember.cancelInvitation.mutationOptions());

	const [email, setEmail] = useState('');
	const [inviteRole, setInviteRole] = useState<AssignableRole>('moderator');
	const [inviteProjectIds, setInviteProjectIds] = useState<Array<string>>([]);
	const [projectSearch, setProjectSearch] = useState('');
	const [editingModeratorId, setEditingModeratorId] = useState<string | null>(null);
	const [transitioningModeratorId, setTransitioningModeratorId] = useState<string | null>(null);
	const [transitionProjectIds, setTransitionProjectIds] = useState<Array<string>>([]);
	const [transitionSearch, setTransitionSearch] = useState('');
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
					Admins manage the organization and every project. Moderators have no organization settings
					access and can manage content only in projects you explicitly assign. Anyone with a Kino
					account can already participate in public projects without joining the organization.
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
							projectIds: inviteRole === 'moderator' ? inviteProjectIds : undefined,
							role: inviteRole,
						},
						{
							onSuccess: () => {
								setEmail('');
								setInviteProjectIds([]);
							},
						}
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
						onChange={(value) => {
							setInviteRole(value);
							if (value !== 'moderator') setInviteProjectIds([]);
						}}
					/>
				</div>
				<Button type='submit' disabled={invite.isPending || !email.trim()}>
					{invite.isPending ? 'Inviting...' : 'Send invite'}
				</Button>
			</form>
			{inviteRole === 'moderator' ? (
				<ProjectPicker
					className='mt-3'
					projects={(projectsQuery.data ?? []).map((project) => ({
						id: project.id,
						name: project.name,
						visibility: project.visibility,
					}))}
					search={projectSearch}
					selectedIds={inviteProjectIds}
					onSearchChange={setProjectSearch}
					onSelectedIdsChange={setInviteProjectIds}
				/>
			) : null}

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
						const isModerator = member.role === 'moderator';
						return (
							<div key={member.id} className='px-4 py-3'>
								<div className='flex items-center gap-3'>
									<Avatar className='size-8 shrink-0'>
										{member.user.image ? <AvatarImage src={member.user.image} /> : null}
										<AvatarFallback className='text-xs font-semibold'>
											{getInitial(member.user.name, member.user.email)}
										</AvatarFallback>
									</Avatar>
									<div className='min-w-0 flex-1'>
										<p className='truncate text-sm font-medium'>
											{member.user.name || member.user.email}
										</p>
										<p className='truncate text-xs text-muted-foreground'>{member.user.email}</p>
										{isModerator ? (
											<p className='text-xs text-muted-foreground'>
												{member.assignedProjectCount === 0
													? 'No project access'
													: `${member.assignedProjectCount} assigned project${member.assignedProjectCount === 1 ? '' : 's'}`}
											</p>
										) : null}
									</div>
									{isOwner ? (
										<Badge variant='outline' className='shrink-0 capitalize'>
											Owner
										</Badge>
									) : (
										<>
											{isModerator ? (
												<Button
													type='button'
													variant='outline'
													size='sm'
													onClick={() =>
														setEditingModeratorId((current) =>
															current === member.id ? null : member.id
														)
													}
												>
													Manage access
												</Button>
											) : null}
											<RoleSelect
												value={member.role as AssignableRole}
												disabled={updateRole.isPending}
												onChange={(value) => {
													if (value === 'moderator' && member.role !== 'moderator') {
														setTransitioningModeratorId(member.id);
														setTransitionProjectIds([]);
														setTransitionSearch('');
														return;
													}
													if (
														member.role === 'moderator' &&
														value === 'admin' &&
														!window.confirm(
															'Promoting this moderator clears their explicit project assignments. Continue?'
														)
													) {
														return;
													}
													updateRole.mutate({
														memberId: member.id,
														role: value,
													});
												}}
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
															`Remove ${member.user.name || member.user.email} from this organization?`
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
								{isModerator && editingModeratorId === member.id ? (
									<ModeratorAccessEditor memberId={member.id} />
								) : null}
								{transitioningModeratorId === member.id ? (
									<div className='mt-3 border-t pt-3'>
										<ProjectPicker
											projects={(projectsQuery.data ?? []).map((project) => ({
												id: project.id,
												name: project.name,
												visibility: project.visibility,
											}))}
											search={transitionSearch}
											selectedIds={transitionProjectIds}
											onSearchChange={setTransitionSearch}
											onSelectedIdsChange={setTransitionProjectIds}
										/>
										<div className='mt-3 flex justify-end gap-2'>
											<Button
												type='button'
												variant='outline'
												onClick={() => setTransitioningModeratorId(null)}
											>
												Cancel
											</Button>
											<Button
												type='button'
												disabled={updateRole.isPending}
												onClick={() =>
													updateRole.mutate(
														{
															memberId: member.id,
															projectIds: transitionProjectIds,
															role: 'moderator',
														},
														{
															onSuccess: () => {
																setTransitioningModeratorId(null);
																setEditingModeratorId(member.id);
															},
														}
													)
												}
											>
												{updateRole.isPending ? 'Saving...' : 'Change to moderator'}
											</Button>
										</div>
									</div>
								) : null}
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
									<p className='text-xs text-muted-foreground capitalize'>
										{inv.role}
										{inv.role === 'moderator'
											? ` · ${inv.assignedProjectCount} project${inv.assignedProjectCount === 1 ? '' : 's'}`
											: ''}
									</p>
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

function ProjectPicker({
	className,
	onSearchChange,
	onSelectedIdsChange,
	projects,
	search,
	selectedIds,
}: {
	className?: string;
	onSearchChange: (value: string) => void;
	onSelectedIdsChange: (value: Array<string>) => void;
	projects: Array<{ id: string; name: string; visibility: string }>;
	search: string;
	selectedIds: Array<string>;
}) {
	const normalizedSearch = search.trim().toLowerCase();
	const visibleProjects = projects.filter((project) =>
		project.name.toLowerCase().includes(normalizedSearch)
	);
	return (
		<div className={cn('rounded-xl border bg-card p-4', className)}>
			<div className='flex items-center justify-between gap-3'>
				<div>
					<p className='text-sm font-medium'>Project access</p>
					<p className='text-xs text-muted-foreground'>
						{selectedIds.length === 0
							? 'No project access'
							: `${selectedIds.length} project${selectedIds.length === 1 ? '' : 's'} selected`}
					</p>
				</div>
				<Input
					className='max-w-56'
					onChange={(event) => onSearchChange(event.target.value)}
					placeholder='Search projects'
					value={search}
				/>
			</div>
			<div className='mt-3 grid gap-2 sm:grid-cols-2'>
				{visibleProjects.map((project) => {
					const checked = selectedIds.includes(project.id);
					return (
						<label
							key={project.id}
							className='flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm'
						>
							<Checkbox
								checked={checked}
								onCheckedChange={(value) =>
									onSelectedIdsChange(
										value === true
											? [...selectedIds, project.id]
											: selectedIds.filter((id) => id !== project.id)
									)
								}
							/>
							<span className='min-w-0 flex-1 truncate'>{project.name}</span>
							<span className='text-xs text-muted-foreground capitalize'>{project.visibility}</span>
						</label>
					);
				})}
			</div>
		</div>
	);
}

function ModeratorAccessEditor({ memberId }: { memberId: string }) {
	const crpc = useCRPC();
	const accessQuery = useQuery(crpc.orgMember.getModeratorProjectAccess.queryOptions({ memberId }));
	const save = useMutation(crpc.orgMember.setModeratorProjectAccess.mutationOptions());
	const [selectedIds, setSelectedIds] = useState<Array<string>>([]);
	const [search, setSearch] = useState('');

	useEffect(() => {
		if (accessQuery.data) {
			setSelectedIds(
				accessQuery.data.projects.filter((project) => project.assigned).map((project) => project.id)
			);
		}
	}, [accessQuery.data]);

	if (accessQuery.isLoading) {
		return <div className='mt-3 h-24 animate-pulse rounded-xl bg-muted/30' />;
	}
	if (!accessQuery.data) return null;

	return (
		<div className='mt-3 border-t pt-3'>
			<ProjectPicker
				projects={accessQuery.data.projects}
				search={search}
				selectedIds={selectedIds}
				onSearchChange={setSearch}
				onSelectedIdsChange={setSelectedIds}
			/>
			<div className='mt-3 flex justify-end'>
				<Button
					type='button'
					disabled={save.isPending}
					onClick={() => save.mutate({ memberId, projectIds: selectedIds })}
				>
					{save.isPending ? 'Saving...' : 'Save project access'}
				</Button>
			</div>
		</div>
	);
}
