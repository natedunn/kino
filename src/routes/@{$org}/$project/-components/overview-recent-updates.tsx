import { Link } from '@tanstack/react-router';
import { MessageSquare } from 'lucide-react';


import { UPDATE_CATEGORY_CONFIG } from '../-overview-config';
import { MOCK_RECENT_UPDATES } from '../-overview-mock-data';
import { OverviewSection } from './overview-section';
import { cn } from '@/lib/utils';
import CalendarDays from '@/icons/calendar-days';

export function OverviewRecentUpdates({ params }: { params: { org: string; project: string } }) {
	return (
		<OverviewSection
			title='Latest updates'
			Icon={CalendarDays}
			bodyClassName='p-0'
			action={
				<Link
					to='/@{$org}/$project/updates'
					params={(prev) => ({ ...prev, ...params })}
					className='link-text text-xs'
				>
					View all
				</Link>
			}
		>
			<ul className='divide-y'>
				{MOCK_RECENT_UPDATES.map((item) => {
					const category = UPDATE_CATEGORY_CONFIG[item.category];
					return (
						<li
							key={item.id}
							className='flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40'
						>
							<div className='min-w-0 flex-1'>
								<p className='truncate text-sm font-medium'>{item.title}</p>
								<div className='mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
									<span className={cn('font-medium', category.colorClass)}>{category.label}</span>
									<span aria-hidden>·</span>
									<span>{item.author}</span>
									<span aria-hidden>·</span>
									<span>{item.date}</span>
								</div>
							</div>
							<span className='flex shrink-0 items-center gap-1 text-xs text-muted-foreground'>
								<MessageSquare className='size-3' />
								{item.commentCount}
							</span>
						</li>
					);
				})}
			</ul>
		</OverviewSection>
	);
}
