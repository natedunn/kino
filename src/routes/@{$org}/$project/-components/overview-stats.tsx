import type { ProjectOverviewData } from '../-overview-types';

import { Card } from '@/components/ui/card';
import ArchivePencil from '@/icons/archive-pencil';
import CalendarDays from '@/icons/calendar-days';
import ChartUp from '@/icons/chart-up';
import Interview from '@/icons/interview';
import Roadmap from '@/icons/roadmap';
import * as m from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';

export function OverviewStats({ stats }: { stats: ProjectOverviewData['stats'] }) {
	const cards = [
		{
			key: 'open-feedback',
			label: m.project_overview_open_feedback(),
			value: stats.openFeedback,
			Icon: ArchivePencil,
		},
		{
			key: 'upvotes',
			label: m.project_overview_total_upvotes(),
			value: stats.upvotes,
			Icon: ChartUp,
		},
		{
			key: 'in-progress',
			label: m.project_overview_in_progress(),
			value: stats.inProgress,
			Icon: Roadmap,
		},
		{
			key: 'updates',
			label: m.project_overview_published_updates(),
			value: stats.publishedUpdates,
			Icon: CalendarDays,
		},
		{ key: 'members', label: m.project_overview_members(), value: stats.members, Icon: Interview },
	];
	const numberFormatter = new Intl.NumberFormat(getLocale());
	return (
		<div className='flex flex-wrap gap-3'>
			{cards.map((stat) => {
				const { Icon } = stat;
				return (
					<Card
						key={stat.key}
						className='min-w-36 flex-1 gap-0 rounded-lg py-0 shadow-none transition-colors hover:border-foreground/20'
					>
						<div className='flex flex-col gap-1 p-3.5'>
							<div className='flex items-center gap-1.5 text-muted-foreground'>
								<Icon className='size-3.5' />
								<span className='truncate text-xs'>{stat.label}</span>
							</div>
							<span
								className='text-2xl font-semibold tabular-nums'
								title={stat.value === null ? m.project_overview_count_unavailable() : undefined}
							>
								{stat.value === null ? '—' : numberFormatter.format(stat.value)}
							</span>
						</div>
					</Card>
				);
			})}
		</div>
	);
}
