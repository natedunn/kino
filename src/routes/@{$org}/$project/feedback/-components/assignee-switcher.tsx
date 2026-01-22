import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Check, ChevronDown, UserCircle } from 'lucide-react';

import { api } from '~api';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Id } from '@/convex/_generated/dataModel';
import LoaderQuarter from '@/icons/loader-quarter';

type AssignedProfile = {
	_id: Id<'profile'>;
	name?: string;
	username: string;
	imageUrl?: string;
} | null;

type AssigneeSwitcherProps = {
	feedbackId: Id<'feedback'>;
	assignedProfile: AssignedProfile;
	projectId: Id<'project'>;
	canEdit: boolean;
};

export function AssigneeSwitcher({
	feedbackId,
	assignedProfile,
	projectId,
	canEdit,
}: AssigneeSwitcherProps) {
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

	// Read-only display
	if (!canEdit) {
		if (!assignedProfile) {
			return <span className='text-sm text-muted-foreground'>Unassigned</span>;
		}

		return (
			<span className='flex items-center gap-1.5 text-sm'>
				<div className='size-4 overflow-hidden rounded-full'>
					{assignedProfile.imageUrl ? (
						<img
							src={assignedProfile.imageUrl}
							alt={assignedProfile.username}
							className='size-4'
						/>
					) : (
						<div className='flex size-4 items-center justify-center bg-primary text-[8px] font-bold text-primary-foreground'>
							{assignedProfile.name?.charAt(0) ?? assignedProfile.username.charAt(0)}
						</div>
					)}
				</div>
				{assignedProfile.name ?? assignedProfile.username}
			</span>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant='outline'
					size='sm'
					disabled={isUpdating}
					className='h-auto gap-1.5 px-2 py-1 text-xs'
				>
					{isUpdating ? (
						<>
							<LoaderQuarter size='14px' className='animate-spin' />
							Updating...
						</>
					) : assignedProfile ? (
						<>
							<div className='size-4 overflow-hidden rounded-full'>
								{assignedProfile.imageUrl ? (
									<img
										src={assignedProfile.imageUrl}
										alt={assignedProfile.username}
										className='size-4'
									/>
								) : (
									<div className='flex size-4 items-center justify-center bg-primary text-[8px] font-bold text-primary-foreground'>
										{assignedProfile.name?.charAt(0) ?? assignedProfile.username.charAt(0)}
									</div>
								)}
							</div>
							{assignedProfile.name ?? assignedProfile.username}
							<ChevronDown size={12} />
						</>
					) : (
						<>
							<UserCircle size={14} className='text-muted-foreground' />
							Unassigned
							<ChevronDown size={12} />
						</>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end' className='w-56'>
				{assignedProfile && (
					<>
						<DropdownMenuItem
							onClick={() => handleAssign(null)}
							className='cursor-pointer gap-2 text-muted-foreground'
						>
							<UserCircle size={14} />
							Unassign
						</DropdownMenuItem>
						<DropdownMenuSeparator />
					</>
				)}
				{assignableMembers?.map((member) => {
					const isAssigned = member.profileId === assignedProfile?._id;
					return (
						<DropdownMenuItem
							key={member.profileId}
							onClick={() => handleAssign(member.profileId)}
							className='cursor-pointer gap-2'
						>
							<div className='size-5 overflow-hidden rounded-full'>
								{member.profile.imageUrl ? (
									<img
										src={member.profile.imageUrl}
										alt={member.profile.username}
										className='size-5'
									/>
								) : (
									<div className='flex size-5 items-center justify-center bg-primary text-[10px] font-bold text-primary-foreground'>
										{member.profile.name?.charAt(0) ?? member.profile.username.charAt(0)}
									</div>
								)}
							</div>
							<span className='flex-1'>{member.profile.name ?? member.profile.username}</span>
							{isAssigned && <Check size={14} className='text-primary' />}
						</DropdownMenuItem>
					);
				})}
				{assignableMembers?.length === 0 && (
					<div className='px-2 py-4 text-center text-sm text-muted-foreground'>
						No members available
					</div>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
