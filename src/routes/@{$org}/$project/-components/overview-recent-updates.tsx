import type { ProjectOverviewData } from '../-overview-types';

import { Link } from '@tanstack/react-router';
import { MessageSquare } from 'lucide-react';

import CalendarDays from '@/icons/calendar-days';
import { cn } from '@/lib/utils';
import { formatTimestamp } from '@/lib/utils/format-timestamp';
import * as m from '@/paraglide/messages.js';

import { UPDATE_CATEGORY_CONFIG } from '../-overview-config';
import { OverviewSection } from './overview-section';

export function OverviewRecentUpdates({
	params,
	updates,
}: {
	params: { org: string; project: string };
	updates: ProjectOverviewData['recentUpdates'];
}) {
	return (
		<OverviewSection
			title={m.project_overview_latest_updates()}
			Icon={CalendarDays}
			bodyClassName='p-0'
			action={
				<Link
					to='/@{$org}/$project/updates'
					params={(prev) => ({ ...prev, ...params })}
					className='link-text text-xs'
				>
					{m.project_overview_view_all()}
				</Link>
			}
		>
			{updates.length === 0 && (
				<p className='px-4 py-3 text-sm text-muted-foreground'>{m.project_overview_no_updates()}</p>
			)}
			<ul className='divide-y'>
				{updates.map((item) => {
					const category = UPDATE_CATEGORY_CONFIG[item.category];
					return (
						<li
							key={item.id}
							className='flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40'
						>
							<div className='min-w-0 flex-1'>
								<p className='truncate text-sm font-medium'>{item.title}</p>
								<div className='mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
									<span className={cn('font-medium', category.colorClass)}>{category.label()}</span>
									<span aria-hidden>·</span>
									<span>{item.author ?? m.project_overview_unknown_actor()}</span>
									<span aria-hidden>·</span>
									<span suppressHydrationWarning>{formatTimestamp(item.publishedAt)}</span>
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
