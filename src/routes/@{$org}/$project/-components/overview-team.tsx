import { Link } from '@tanstack/react-router';
import { MOCK_MEMBERS } from '../-overview-mock-data';
import { OverviewSection } from './overview-section';
import type { Member } from '../-overview-types';


import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Interview from '@/icons/interview';
import { cn } from '@/lib/utils';


function initials(name: string) {
	return name
		.split(' ')
		.map((part) => part.charAt(0))
		.slice(0, 2)
		.join('')
		.toUpperCase();
}

const ROLE_CLASS: Record<Member['role'], string> = {
	Owner: 'text-primary',
	Admin: 'text-foreground',
	Editor: 'text-muted-foreground',
	Member: 'text-muted-foreground',
};

export function OverviewTeam({
	params,
	canEdit,
}: {
	params: { org: string; project: string };
	canEdit: boolean;
}) {
	return (
		<OverviewSection
			title='Team'
			Icon={Interview}
			action={
				canEdit ? (
					<Link
						to='/@{$org}/$project/settings/members'
						params={(prev) => ({ ...prev, ...params })}
						className='link-text text-xs'
					>
						Manage
					</Link>
				) : undefined
			}
		>
			<ul className='flex flex-col gap-2.5'>
				{MOCK_MEMBERS.slice(0, 6).map((member) => (
					<li key={member.id} className='flex items-center gap-2.5'>
						<Avatar className='size-7'>
							{member.imageUrl && <AvatarImage src={member.imageUrl} alt='' />}
							<AvatarFallback className='text-[10px] text-background'>
								{initials(member.name)}
							</AvatarFallback>
						</Avatar>
						<span className='min-w-0 flex-1 truncate text-sm'>{member.name}</span>
						<span className={cn('text-xs', ROLE_CLASS[member.role])}>{member.role}</span>
					</li>
				))}
			</ul>
			{MOCK_MEMBERS.length > 6 && (
				<p className='mt-3 text-xs text-muted-foreground'>
					+{MOCK_MEMBERS.length - 6} more members
				</p>
			)}
		</OverviewSection>
	);
}
