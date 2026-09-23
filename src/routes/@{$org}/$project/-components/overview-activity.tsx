import type { ProjectOverviewData } from '../-overview-types';

import { ActivityFeed } from '@/components/feed/activity-feed';
import Bell from '@/icons/bell';
import { formatTimestamp } from '@/lib/utils/format-timestamp';
import * as m from '@/paraglide/messages.js';

export function OverviewActivity({ activity }: { activity: ProjectOverviewData['activity'] }) {
	return (
		<section className='flex flex-col gap-4'>
			<div className='flex items-center gap-2'>
				<Bell className='size-4 text-muted-foreground' />
				<h2 className='text-sm font-semibold'>{m.project_overview_activity()}</h2>
			</div>
			{activity.length === 0 && (
				<p className='text-sm text-muted-foreground'>{m.project_overview_no_activity()}</p>
			)}

			{/* Within a single project the actor is the subject of each row. */}
			<ActivityFeed
				items={activity.map((event) => ({
					id: event.id,
					kind: event.kind,
					when: formatTimestamp(event.at),
					avatarLabel: event.actor ?? m.project_overview_unknown_actor(),
					primary: (
						<>
							<span className='font-semibold'>
								{event.actor ?? m.project_overview_unknown_actor()}
							</span>{' '}
							<span className='text-muted-foreground'>
								{event.kind === 'update_published'
									? m.project_overview_published({ title: event.title })
									: m.project_overview_opened({ title: event.title })}
							</span>
						</>
					),
				}))}
			/>
		</section>
	);
}
