import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';

import { InlineAlert } from '@/components/inline-alert';
import { EmptyState } from '@/components/kino/common';
import { Label, LabelDescription, LabelWrapper } from '@/components/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { extractErrorMessage } from '@/lib/errors';
import { titleMeta } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { emailSchema, FORM_LIMITS } from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

import { SettingsSkeleton } from '../-components/settings-skeleton';
import { useDelayedFlag } from '../-components/use-delayed-flag';
import { useSettingsOrgSlug } from '../-components/use-settings-org';

export const Route = createFileRoute('/org/settings/members/')({
	head: () => ({
		meta: [titleMeta([m.meta_members()])],
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

type MemberRole = AssignableRole | 'owner';

const ROLE_LABELS: Record<MemberRole, () => string> = {
	admin: m.role_admin,
	moderator: m.role_moderator,
	owner: m.role_owner,
};

type PickerProject = { id: string; name: string; visibility: string };

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
	const [emailTouched, setEmailTouched] = useState(false);
	const [inviteRole, setInviteRole] = useState<AssignableRole>('moderator');
	const [inviteProjectIds, setInviteProjectIds] = useState<Array<string>>([]);
	const [editingModeratorId, setEditingModeratorId] = useState<string | null>(null);
	const [transitioningModeratorId, setTransitioningModeratorId] = useState<string | null>(null);
	const [transitionProjectIds, setTransitionProjectIds] = useState<Array<string>>([]);
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
				title={m.org_members_unavailable()}
				description={m.org_members_unavailable_description()}
			/>
		);
	}

	if (!data.canManage) {
		return (
			<EmptyState
				title={m.org_member_management_unavailable()}
				description={m.org_member_management_unavailable_description()}
			/>
		);
	}

	const projects: Array<PickerProject> = (projectsQuery.data ?? []).map((project) => ({
		id: project.id,
		name: project.name,
		visibility: project.visibility,
	}));

	const isEmailValid = emailSchema.safeParse(email.trim()).success;
	const showEmailInvalid = emailTouched && email.trim().length > 0 && !isEmailValid;

	const actionError =
		mutationErrorMessage(invite.error) ??
		mutationErrorMessage(updateRole.error) ??
		mutationErrorMessage(removeMember.error) ??
		mutationErrorMessage(cancelInvite.error);

	return (
		<section className='max-w-3xl'>
			<header className='border-b pb-4'>
				<h2 className='text-xl font-semibold'>{m.settings_members()}</h2>
				<p className='mt-1 text-sm text-muted-foreground'>{m.org_members_description()}</p>
			</header>

			{/* Invite */}
			<h3 className='mt-8 text-base font-semibold'>{m.org_members_invite_title()}</h3>
			<form
				className='mt-3 overflow-hidden rounded-xl border bg-card'
				onSubmit={(event) => {
					event.preventDefault();
					setFormError(null);
					const parsed = emailSchema.safeParse(email.trim());
					if (!parsed.success) {
						setEmailTouched(true);
						setFormError(parsed.error.issues[0]?.message ?? m.org_members_invalid_email());
						return;
					}
					invite.mutate(
						{
							email: parsed.data,
							organizationId,
							// So the emailed accept link points at the environment the
							// invite was sent from; the server validates it.
							origin: window.location.origin,
							projectIds: inviteRole === 'moderator' ? inviteProjectIds : undefined,
							role: inviteRole,
						},
						{
							onSuccess: () => {
								setEmail('');
								setEmailTouched(false);
								setInviteProjectIds([]);
							},
						}
					);
				}}
			>
				<div className='flex flex-col gap-4 p-6 sm:flex-row'>
					<div className='flex flex-1 flex-col gap-2'>
						<LabelWrapper className='mb-0'>
							<Label htmlFor='invite-email'>{m.org_members_email()}</Label>
						</LabelWrapper>
						<Input
							aria-invalid={showEmailInvalid || undefined}
							autoCapitalize='none'
							autoComplete='off'
							id='invite-email'
							inputMode='email'
							maxLength={FORM_LIMITS.email}
							onBlur={() => setEmailTouched(true)}
							onChange={(event) => setEmail(event.target.value)}
							placeholder='teammate@example.com'
							spellCheck={false}
							type='email'
							value={email}
						/>
						{showEmailInvalid ? (
							<p className='text-xs text-destructive'>{m.org_members_invalid_email()}</p>
						) : null}
					</div>
					<div className='flex flex-col gap-2'>
						<LabelWrapper className='mb-0'>
							<Label htmlFor='invite-role'>{m.org_members_role()}</Label>
						</LabelWrapper>
						<RoleSelect
							id='invite-role'
							triggerClassName='w-full sm:w-40'
							value={inviteRole}
							onChange={(value) => {
								setInviteRole(value);
								if (value !== 'moderator') setInviteProjectIds([]);
							}}
						/>
					</div>
				</div>

				{/* Admins always have access to every project, so project access only
				    applies when inviting a moderator. */}
				{inviteRole === 'moderator' ? (
					<div className='border-t px-6 py-5'>
						<ProjectPicker
							description={m.org_members_moderator_description()}
							projects={projects}
							selectedIds={inviteProjectIds}
							onSelectedIdsChange={setInviteProjectIds}
						/>
					</div>
				) : null}

				<div className='flex items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4'>
					<p className='text-xs text-muted-foreground'>
						{inviteRole === 'admin'
							? m.org_members_admin_description()
							: inviteProjectIds.length === 0
								? m.org_members_select_project()
								: m.org_members_moderator_access_count({ count: inviteProjectIds.length })}
					</p>
					<Button
						type='submit'
						disabled={
							invite.isPending ||
							!isEmailValid ||
							(inviteRole === 'moderator' && inviteProjectIds.length === 0)
						}
					>
						{invite.isPending ? m.org_members_inviting() : m.org_members_send_invite()}
					</Button>
				</div>
			</form>

			{(formError ?? actionError) ? (
				<div className='mt-4'>
					<InlineAlert variant='danger'>{formError ?? actionError}</InlineAlert>
				</div>
			) : null}

			{/* Members */}
			<div className='mt-10'>
				<h3 className='text-base font-semibold'>
					{m.org_members_existing()}{' '}
					<span className='text-sm font-normal text-muted-foreground'>({data.members.length})</span>
				</h3>
				<div className='mt-3 flex flex-col divide-y rounded-xl border bg-card'>
					{data.members.map((member) => {
						const isOwner = member.role === 'owner';
						const isModerator = member.role === 'moderator';
						return (
							<div key={member.id} className='px-4 py-3'>
								<div className='flex items-center gap-3'>
									<Avatar
										className='size-8 shrink-0'
										fallbackName={member.user.username ?? member.user.email}
									>
										{member.user.image ? <AvatarImage src={member.user.image} /> : null}
										<AvatarFallback />
									</Avatar>
									<div className='min-w-0 flex-1'>
										<p className='truncate text-sm font-medium'>
											{member.user.name || member.user.email}
										</p>
										<p className='truncate text-xs text-muted-foreground'>
											{member.user.email}
											{isModerator
												? ` · ${
														member.assignedProjectCount === 0
															? m.org_members_no_project_access()
															: m.org_members_project_count({ count: member.assignedProjectCount })
													}`
												: ''}
										</p>
									</div>
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
											{editingModeratorId === member.id
												? m.common_close()
												: m.org_members_manage_access()}
										</Button>
									) : null}
									{/* The owner's controls render disabled: the role select and remove
										    button are decorative there, and the server rejects owner role
										    changes/removal regardless of what the client sends. */}
									<RoleSelect
										size='sm'
										value={member.role as MemberRole}
										disabled={isOwner || updateRole.isPending}
										onChange={(value) => {
											if (value === 'moderator' && member.role !== 'moderator') {
												setTransitioningModeratorId(member.id);
												setTransitionProjectIds([]);
												return;
											}
											if (
												member.role === 'moderator' &&
												value === 'admin' &&
												!window.confirm(m.org_members_promote_confirm())
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
										className='shrink-0 text-destructive hocus:text-destructive'
										disabled={isOwner || removeMember.isPending}
										onClick={() => {
											if (
												window.confirm(
													m.org_members_remove_confirm({
														name: member.user.name || member.user.email,
													})
												)
											) {
												removeMember.mutate({ memberId: member.id });
											}
										}}
									>
										<Trash2 />
										{m.common_remove()}
									</Button>
								</div>
								{isModerator && editingModeratorId === member.id ? (
									<ModeratorAccessEditor
										memberId={member.id}
										onSaved={() => setEditingModeratorId(null)}
									/>
								) : null}
								{transitioningModeratorId === member.id ? (
									<div className='mt-3 rounded-lg border bg-accent/30 p-4'>
										<ProjectPicker
											description={m.org_members_pick_projects()}
											projects={projects}
											selectedIds={transitionProjectIds}
											onSelectedIdsChange={setTransitionProjectIds}
										/>
										<div className='mt-4 flex justify-end gap-2'>
											<Button
												type='button'
												variant='outline'
												size='sm'
												onClick={() => setTransitioningModeratorId(null)}
											>
												{m.common_cancel()}
											</Button>
											<Button
												type='button'
												size='sm'
												disabled={updateRole.isPending || transitionProjectIds.length === 0}
												onClick={() =>
													updateRole.mutate(
														{
															memberId: member.id,
															projectIds: transitionProjectIds,
															role: 'moderator',
														},
														{
															onSuccess: () => setTransitioningModeratorId(null),
														}
													)
												}
											>
												{updateRole.isPending
													? m.common_saving()
													: m.org_members_change_moderator()}
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
				<div className='mt-10'>
					<h3 className='text-base font-semibold'>{m.org_members_pending()}</h3>
					<div className='mt-3 flex flex-col divide-y rounded-xl border bg-card'>
						{pendingQuery.data.map((inv) => (
							<div key={inv.id} className='flex items-center gap-3 px-4 py-3'>
								<div className='min-w-0 flex-1'>
									<p className='truncate text-sm font-medium'>{inv.email}</p>
									<p className='text-xs text-muted-foreground capitalize'>
										{inv.role}
										{inv.role === 'moderator'
											? ` · ${m.org_members_project_count({ count: inv.assignedProjectCount })}`
											: ''}
									</p>
								</div>
								<Button
									type='button'
									variant='ghost'
									size='sm'
									className='shrink-0 text-destructive hocus:text-destructive'
									disabled={cancelInvite.isPending}
									onClick={() => cancelInvite.mutate({ invitationId: inv.id })}
								>
									{m.org_members_cancel_invite()}
								</Button>
							</div>
						))}
					</div>
					<p className='mt-2 text-xs text-muted-foreground'>
						{m.org_members_invite_delivery_notice()}
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
	size = 'default',
	triggerClassName,
}: {
	id?: string;
	value: MemberRole;
	onChange: (value: AssignableRole) => void;
	disabled?: boolean;
	size?: 'sm' | 'default';
	triggerClassName?: string;
}) {
	return (
		<Select
			value={value}
			disabled={disabled}
			onValueChange={(next) => onChange(next as AssignableRole)}
		>
			<SelectTrigger id={id} size={size} className={cn('shrink-0', triggerClassName)}>
				<SelectValue placeholder={m.org_members_role()}>
					{(current) => ROLE_LABELS[current as MemberRole]()}
				</SelectValue>
			</SelectTrigger>
			<SelectContent>
				{/* Owner exists only so the (always-disabled) owner row can display its
				    value — it is never offered as a choice for anyone else. */}
				{value === 'owner' ? <SelectItem value='owner'>{m.role_owner()}</SelectItem> : null}
				{ASSIGNABLE_ROLES.map((role) => (
					<SelectItem key={role} value={role}>
						{ROLE_LABELS[role]()}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function ProjectPicker({
	description,
	onSelectedIdsChange,
	projects,
	selectedIds,
}: {
	description: string;
	onSelectedIdsChange: (value: Array<string>) => void;
	projects: Array<PickerProject>;
	selectedIds: Array<string>;
}) {
	return (
		<div>
			<LabelWrapper>
				<Label>{m.org_members_project_access()}</Label>
				<LabelDescription>{description}</LabelDescription>
			</LabelWrapper>
			{projects.length === 0 ? (
				<p className='text-sm text-muted-foreground'>{m.org_members_no_projects()}</p>
			) : (
				<div className='grid gap-2 sm:grid-cols-2'>
					{projects.map((project) => {
						const checked = selectedIds.includes(project.id);
						return (
							<label
								key={project.id}
								className={cn(
									'flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors',
									checked ? 'border-ring/50 bg-accent/60' : 'hover:bg-accent/40'
								)}
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
								<span className='text-xs text-muted-foreground capitalize'>
									{project.visibility}
								</span>
							</label>
						);
					})}
				</div>
			)}
		</div>
	);
}

function ModeratorAccessEditor({ memberId, onSaved }: { memberId: string; onSaved: () => void }) {
	const crpc = useCRPC();
	const accessQuery = useQuery(crpc.orgMember.getModeratorProjectAccess.queryOptions({ memberId }));
	const save = useMutation(crpc.orgMember.setModeratorProjectAccess.mutationOptions());
	const [selectedIds, setSelectedIds] = useState<Array<string>>([]);

	useEffect(() => {
		if (accessQuery.data) {
			setSelectedIds(
				accessQuery.data.projects.filter((project) => project.assigned).map((project) => project.id)
			);
		}
	}, [accessQuery.data]);

	if (accessQuery.isLoading) {
		return <div className='mt-3 h-24 animate-pulse rounded-lg bg-muted/30' />;
	}
	if (!accessQuery.data) return null;

	return (
		<div className='mt-3 rounded-lg border bg-accent/30 p-4'>
			<ProjectPicker
				description={m.org_members_pick_projects()}
				projects={accessQuery.data.projects}
				selectedIds={selectedIds}
				onSelectedIdsChange={setSelectedIds}
			/>
			<div className='mt-4 flex justify-end'>
				<Button
					type='button'
					size='sm'
					disabled={save.isPending}
					onClick={() => save.mutate({ memberId, projectIds: selectedIds }, { onSuccess: onSaved })}
				>
					{save.isPending ? m.common_saving() : m.org_members_save_access()}
				</Button>
			</div>
		</div>
	);
}
