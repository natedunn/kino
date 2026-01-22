import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Check, ChevronDown, UserCircle } from 'lucide-react';

import { api, API } from '~api';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Id } from '@/convex/_generated/dataModel';
import LoaderQuarter from '@/icons/loader-quarter';
import { cn } from '@/lib/utils';

type AssignedProfile = NonNullable<API['feedback']['getBySlug']>['assignedProfile'];

type AssignedToProps = {
	feedbackId: Id<'feedback'>;
	assignedProfile: AssignedProfile;
	projectId: Id<'project'>;
	canEdit: boolean;
};

export function AssignedTo({ feedbackId, assignedProfile, projectId, canEdit }: AssignedToProps) {
	const { data: assignableMembers } = useSuspenseQuery(
		convexQuery(api.projectMember.listAssignableMembers, { projectId })
	);

	const { mutate: updateAssigned, status: mutationStatus } = useMutation({
		mutationFn: useConvexMutation(api.feedback.updateAssigned),
	});

	const isUpdating = mutationStatus === 'pending';

	const handleAssign = (profileId: Id<'profile'> | null) => {
		if (profileId !== assignedProfile?._id) {
			updateAssigned({ feedbackId, assignedProfileId: profileId });
		}
	};

	// Read-only display (no edit permissions)
	if (!canEdit) {
		if (!assignedProfile) {
			return (
				<div className='flex overflow-hidden rounded-lg border'>
					<div className='z-10 flex items-center justify-center border-r bg-muted px-4'>
						<div className='-mr-9 flex size-10 items-center justify-center overflow-hidden rounded-full border bg-muted'>
							<UserCircle className='size-6 text-muted-foreground' />
						</div>
					</div>
					<div className='flex w-full flex-col justify-center bg-background px-8 py-3'>
						<div className='text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
							Assigned to
						</div>
						<div className='text-muted-foreground'>Unassigned</div>
					</div>
				</div>
			);
		}

		return (
			<div className='flex overflow-hidden rounded-lg border'>
				<div className='z-10 flex items-center justify-center border-r bg-muted px-4'>
					<div className='-mr-9 size-10 overflow-hidden rounded-full border'>
						{assignedProfile.imageUrl ? (
							<img
								src={assignedProfile.imageUrl}
								alt={assignedProfile.username}
								className='size-10'
							/>
						) : (
							<div className='flex size-10 items-center justify-center bg-primary text-sm font-bold text-primary-foreground'>
								{assignedProfile.name?.charAt(0) ?? assignedProfile.username.charAt(0)}
							</div>
						)}
					</div>
				</div>
				<div className='flex w-full flex-col justify-center bg-background px-8 py-3'>
					<div className='text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
						Assigned to
					</div>
					<div>
						{assignedProfile.name ?? assignedProfile.username} (@{assignedProfile.username})
					</div>
				</div>
			</div>
		);
	}

	// Editable dropdown
	return (
		<div className='flex overflow-hidden rounded-lg border'>
			<div className='z-10 flex items-center justify-center border-r bg-muted px-4'>
				<div className='-mr-9 size-10 overflow-hidden rounded-full border'>
					{isUpdating ? (
						<div className='flex size-10 items-center justify-center bg-muted'>
							<LoaderQuarter className='size-5 -translate-x-px -translate-y-px animate-spin text-muted-foreground' />
						</div>
					) : assignedProfile?.imageUrl ? (
						<img
							src={assignedProfile.imageUrl}
							alt={assignedProfile.username}
							className='size-10'
						/>
					) : assignedProfile ? (
						<div className='flex size-10 items-center justify-center bg-primary text-sm font-bold text-primary-foreground'>
							{assignedProfile.name?.charAt(0) ?? assignedProfile.username.charAt(0)}
						</div>
					) : (
						<div className='flex size-9.5 items-center justify-center bg-muted'>
							<UserCircle className='size-6 text-muted-foreground' />
						</div>
					)}
				</div>
			</div>
			<div className='flex w-full items-center justify-between bg-background py-3 pr-5 pl-8'>
				<div className='flex flex-col'>
					<div className='text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
						Assigned to
					</div>
					<div>
						{isUpdating
							? 'Updating...'
							: assignedProfile
								? `${assignedProfile.name ?? assignedProfile.username} (@${assignedProfile.username})`
								: 'Unassigned'}
					</div>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							disabled={isUpdating}
							className='flex size-8 cursor-pointer items-center justify-center rounded-md border bg-muted transition-colors hover:bg-accent disabled:cursor-wait disabled:opacity-70'
						>
							<ChevronDown className='size-4 text-muted-foreground' />
							<span className='sr-only'>Change assignee</span>
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align='end' className='w-64'>
						<DropdownMenuLabel>Assign to:</DropdownMenuLabel>
						<DropdownMenuSeparator />
						{assignableMembers?.map((member) => {
							const isAssigned = member.profileId === assignedProfile?._id;
							return (
								<DropdownMenuItem
									key={member.profileId}
									onClick={() => handleAssign(isAssigned ? null : member.profileId)}
									className='cursor-pointer gap-2'
								>
									<div className='size-6 overflow-hidden rounded-full border'>
										{member.profile.imageUrl ? (
											<img
												src={member.profile.imageUrl}
												alt={member.profile.username}
												className='size-6'
											/>
										) : (
											<div className='flex size-6 items-center justify-center bg-primary text-xs font-bold text-primary-foreground'>
												{member.profile.name?.charAt(0) ?? member.profile.username.charAt(0)}
											</div>
										)}
									</div>
									<div className='flex flex-1 flex-col'>
										<span>{member.profile.name ?? member.profile.username}</span>
										<span className='text-xs text-muted-foreground'>
											{isAssigned ? 'Click to unassign' : `@${member.profile.username}`}
										</span>
									</div>
									{isAssigned && <Check className='size-4 text-primary' />}
								</DropdownMenuItem>
							);
						})}
						{assignableMembers?.length === 0 && (
							<div className='px-2 py-4 text-center text-sm text-muted-foreground'>
								No members with edit permissions
							</div>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
