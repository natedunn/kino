import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';

import { InlineAlert } from '@/components/inline-alert';
import { EmptyState } from '@/components/kino/common';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { localizeError } from '@/lib/errors';
import { titleMeta } from '@/lib/seo';
import { emailSchema, FORM_LIMITS } from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

import { ArchivedSettingsNotice } from '../-components/archived-notice';

export const Route = createFileRoute('/@{$org}/$project/settings/members/')({
	head: () => ({
		meta: [titleMeta([m.meta_members()])],
	}),
	loader: async ({ context, params }) => {
		const details = await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({
				orgSlug: params.org,
				slug: params.project,
			})
		);
		const projectId = (details as { project?: { id?: string } } | null)?.project?.id;
		if (projectId && context.loaderToken) {
			await Promise.all([
				context.queryClient.ensureQueryData(
					crpcServer.projectMember.listProjectMembers.queryOptions({ projectId })
				),
				context.queryClient.ensureQueryData(
					crpcServer.projectAccess.getManagementState.queryOptions({ projectId })
				),
			]);
		}
	},
	component: ProjectMembersRoute,
});

function mutationErrorMessage(error: unknown) {
	if (!error) return null;
	return localizeError(error);
}

function ProjectMembersRoute() {
	const params = Route.useParams();
	const crpc = useCRPC();

	const detailsQuery = useQuery(
		crpc.project.getDetails.queryOptions({
			orgSlug: params.org,
			slug: params.project,
		})
	);

	const project = detailsQuery.data?.project;
	const projectId = project?.id;
	const canManageAccess = detailsQuery.data?.permissions.canManageAccess ?? false;

	const membersQuery = useQuery(
		crpc.projectMember.listProjectMembers.queryOptions(
			{ projectId: projectId ?? '' },
			{ enabled: !!projectId && canManageAccess }
		)
	);
	const accessQuery = useQuery(
		crpc.projectAccess.getManagementState.queryOptions(
			{ projectId: projectId ?? '' },
			{ enabled: !!projectId && canManageAccess }
		)
	);

	const invite = useMutation(crpc.projectMember.inviteProjectMember.mutationOptions());
	const removeMember = useMutation(crpc.projectMember.removeProjectMember.mutationOptions());
	const setModeratorAccess = useMutation(crpc.projectAccess.setModeratorAccess.mutationOptions());

	const [email, setEmail] = useState('');
	const [formError, setFormError] = useState<string | null>(null);

	if (detailsQuery.isLoading) {
		return <div className='h-64 animate-pulse rounded-xl border bg-muted/30' />;
	}

	if (!project || !projectId) {
		return (
			<EmptyState
				title={m.project_members_unavailable()}
				description={m.project_members_unavailable_description()}
			/>
		);
	}

	if (!canManageAccess) {
		return (
			<EmptyState
				title={m.project_member_management_unavailable()}
				description={m.project_member_management_unavailable_description()}
			/>
		);
	}

	const isPrivate = project.visibility === 'private';
	const isArchived = project.visibility === 'archived';
	const members = membersQuery.data?.members ?? [];
	const moderators = accessQuery.data?.moderators ?? [];
	const actionError =
		mutationErrorMessage(invite.error) ??
		mutationErrorMessage(removeMember.error) ??
		mutationErrorMessage(setModeratorAccess.error);

	return (
		<section className='max-w-3xl'>
			{isArchived ? <ArchivedSettingsNotice className='mb-6' /> : null}
			<header className='border-b pb-4'>
				<h2 className='text-xl font-semibold'>{m.project_members_title()}</h2>
				<p className='mt-1 text-sm text-muted-foreground'>{m.project_members_description()}</p>
			</header>

			<div className='mt-8'>
				<h3 className='text-sm font-bold text-muted-foreground'>{m.org_members_moderators()}</h3>
				<p className='mt-1 text-sm text-muted-foreground'>{m.project_moderators_description()}</p>
				{moderators.length === 0 ? (
					<p className='mt-3 text-sm text-muted-foreground'>{m.project_members_no_moderators()}</p>
				) : (
					<div className='mt-3 flex flex-col divide-y rounded-xl border bg-card'>
						{moderators.map((moderator) => (
							<div key={moderator.memberId} className='flex items-center gap-3 px-4 py-3'>
								<Avatar className='size-8 shrink-0' fallbackName={moderator.profile.username}>
									{moderator.profile.imageUrl ? (
										<AvatarImage
											alt={moderator.profile.name ?? moderator.profile.username}
											src={moderator.profile.imageUrl}
										/>
									) : null}
									<AvatarFallback />
								</Avatar>
								<div className='min-w-0 flex-1'>
									<p className='truncate text-sm font-medium'>
										{moderator.profile.name ?? moderator.profile.username}
									</p>
									<p className='truncate text-xs text-muted-foreground'>
										@{moderator.profile.username}
									</p>
								</div>
								<Button
									type='button'
									variant={moderator.assigned ? 'outline' : 'default'}
									size='sm'
									disabled={setModeratorAccess.isPending}
									onClick={() =>
										setModeratorAccess.mutate({
											enabled: !moderator.assigned,
											memberId: moderator.memberId,
											projectId,
										})
									}
								>
									{moderator.assigned
										? m.project_members_remove_access()
										: m.project_members_grant_access()}
								</Button>
							</div>
						))}
					</div>
				)}
			</div>

			{!isPrivate ? (
				<div className='mt-4'>
					<InlineAlert variant='info'>{m.project_members_public_notice()}</InlineAlert>
				</div>
			) : null}

			{/* Direct members */}
			<form
				className='mt-8 flex flex-col gap-3 rounded-xl border bg-card p-6 sm:flex-row sm:items-end'
				onSubmit={(event) => {
					event.preventDefault();
					setFormError(null);
					const parsed = emailSchema.safeParse(email);
					if (!parsed.success) {
						setFormError(m.project_members_invalid_email());
						return;
					}
					invite.mutate({ email: parsed.data, projectId }, { onSuccess: () => setEmail('') });
				}}
			>
				<div className='flex flex-1 flex-col gap-2'>
					<label className='text-sm font-medium' htmlFor='member-email'>
						{m.project_members_add_by_email()}
					</label>
					<Input
						autoCapitalize='none'
						autoComplete='email'
						id='member-email'
						inputMode='email'
						maxLength={FORM_LIMITS.email}
						onChange={(event) => setEmail(event.target.value)}
						placeholder='person@example.com'
						spellCheck={false}
						type='email'
						value={email}
					/>
				</div>
				<Button type='submit' disabled={invite.isPending || !email.trim()}>
					{invite.isPending ? m.project_members_adding() : m.project_members_add()}
				</Button>
			</form>
			<p className='mt-2 text-xs text-muted-foreground'>{m.project_members_account_required()}</p>

			{(formError ?? actionError) ? (
				<div className='mt-4'>
					<InlineAlert variant='danger'>{formError ?? actionError}</InlineAlert>
				</div>
			) : null}

			{/* Members */}
			<div className='mt-8'>
				<h3 className='text-sm font-bold text-muted-foreground'>
					{m.project_members_count({ count: members.length })}
				</h3>
				{members.length === 0 ? (
					<p className='mt-3 text-sm text-muted-foreground'>{m.project_members_empty()}</p>
				) : (
					<div className='mt-3 flex flex-col divide-y rounded-xl border bg-card'>
						{members.map((member) => (
							<div key={member.id} className='flex items-center gap-3 px-4 py-3'>
								<Avatar className='size-8 shrink-0' fallbackName={member.profile.username}>
									{member.profile.imageUrl ? (
										<AvatarImage
											alt={member.profile.name ?? member.profile.username}
											src={member.profile.imageUrl}
										/>
									) : null}
									<AvatarFallback />
								</Avatar>
								<div className='min-w-0 flex-1'>
									<p className='truncate text-sm font-medium'>
										{member.profile.name ?? member.profile.username}
									</p>
									<p className='truncate text-xs text-muted-foreground'>
										@{member.profile.username}
									</p>
								</div>
								<Button
									type='button'
									variant='ghost'
									size='sm'
									className='shrink-0 text-muted-foreground hover:text-destructive'
									disabled={removeMember.isPending}
									onClick={() => {
										if (
											window.confirm(
												m.project_members_remove_confirm({
													name: member.profile.name ?? member.profile.username,
												})
											)
										) {
											removeMember.mutate({ projectMemberId: member.id });
										}
									}}
								>
									<Trash2 className='size-4' />
									<span className='sr-only'>{m.project_members_remove()}</span>
								</Button>
							</div>
						))}
					</div>
				)}
			</div>
		</section>
	);
}
