import { ActivityFeed } from '@/components/feed/activity-feed';
import Bell from '@/icons/bell';

import { MOCK_ACTIVITY } from '../-overview-mock-data';

export function OverviewActivity() {
	return (
		<section className='flex flex-col gap-4'>
			<div className='flex items-center gap-2'>
				<Bell className='size-4 text-muted-foreground' />
				<h2 className='text-sm font-semibold'>Activity</h2>
			</div>

			{/* Within a single project the actor is the subject of each row. */}
			<ActivityFeed
				items={MOCK_ACTIVITY.map((event) => ({
					id: event.id,
					kind: event.kind,
					when: event.when,
					avatarLabel: event.actor,
					primary: (
						<>
							<span className='font-semibold'>{event.actor}</span>{' '}
							<span className='text-muted-foreground'>{event.summary}</span>
						</>
					),
				}))}
			/>
		</section>
	);
}
