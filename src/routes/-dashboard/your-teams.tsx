import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';

import { SectionCard } from '@/components/section-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Home from '@/icons/home';
import { getInitial } from '@/lib/utils/get-initial';

interface Team {
	id: string;
	name: string;
	slug: string;
	logo?: string | null;
}

// Sidebar widget: a compact, live list of the teams (orgs) a user belongs to.
// Deep project browsing lives one click away on each org page.
export function YourTeams({ teams, underLimit }: { teams: Array<Team>; underLimit: boolean }) {
	return (
		<SectionCard
			title='Your teams'
			Icon={Home}
			bodyClassName={teams.length === 0 ? undefined : 'p-0'}
			action={
				underLimit ? (
					<Link to='/create/team' className='link-text text-xs'>
						New team
					</Link>
				) : undefined
			}
		>
			{teams.length === 0 ? (
				<div className='text-center'>
					<p className='text-sm text-muted-foreground'>You're not part of any teams yet.</p>
					<Link to='/create/team' className='link-text mt-2 inline-block text-sm'>
						Create a team
					</Link>
				</div>
			) : (
				<ul className='divide-y'>
					{teams.map((team) => (
						<li key={team.id}>
							<Link
								to='/@{$org}'
								params={{ org: team.slug }}
								className='group flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-muted/40'
							>
								<Avatar className='size-7 border'>
									{team.logo ? <AvatarImage src={team.logo} alt='' /> : null}
									<AvatarFallback className='text-xs font-semibold'>
										{getInitial(team.name)}
									</AvatarFallback>
								</Avatar>
								<span className='min-w-0 flex-1 truncate text-sm font-medium'>{team.name}</span>
								<ArrowRight className='size-3.5 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100' />
							</Link>
						</li>
					))}
				</ul>
			)}
		</SectionCard>
	);
}
