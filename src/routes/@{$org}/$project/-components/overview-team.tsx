import type { ProjectOverviewData } from '../-overview-types';

import { Link } from '@tanstack/react-router';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Interview from '@/icons/interview';
import { cn } from '@/lib/utils';
import * as m from '@/paraglide/messages.js';

import { OverviewSection } from './overview-section';

const ROLE_CLASS: Record<ProjectOverviewData['members'][number]['role'], string> = {
	owner: 'text-primary',
	admin: 'text-foreground',
	moderator: 'text-muted-foreground',
	member: 'text-muted-foreground',
};

export function OverviewTeam({
	params,
	canEdit,
	members,
	memberCount,
}: {
	params: { org: string; project: string };
	canEdit: boolean;
	members: ProjectOverviewData['members'];
	memberCount: number | null;
}) {
	const roleLabels = {
		owner: m.project_overview_owner(),
		admin: m.project_overview_admin(),
		moderator: m.project_overview_moderator(),
		member: m.project_overview_member(),
	};
	return (
		<OverviewSection
			title={m.project_overview_team()}
			Icon={Interview}
			action={
				canEdit ? (
					<Link
						to='/@{$org}/$project/settings/members'
						params={(prev) => ({ ...prev, ...params })}
						className='link-text text-xs'
					>
						{m.project_overview_manage()}
					</Link>
				) : undefined
			}
		>
			{members.length === 0 && (
				<p className='text-sm text-muted-foreground'>{m.project_overview_no_members()}</p>
			)}
			<ul className='flex flex-col gap-2.5'>
				{members.map((member) => (
					<li key={member.id} className='flex items-center gap-2.5'>
						<Avatar className='size-7' fallbackName={member.username}>
							{member.imageUrl && <AvatarImage src={member.imageUrl} alt='' />}
							<AvatarFallback />
						</Avatar>
						<span className='min-w-0 flex-1 truncate text-sm'>{member.name}</span>
						<span className={cn('text-xs', ROLE_CLASS[member.role])}>
							{roleLabels[member.role]}
						</span>
					</li>
				))}
			</ul>
			{memberCount !== null && memberCount > members.length && (
				<p className='mt-3 text-xs text-muted-foreground'>
					{m.project_overview_more_members({ count: String(memberCount - members.length) })}
				</p>
			)}
		</OverviewSection>
	);
}
