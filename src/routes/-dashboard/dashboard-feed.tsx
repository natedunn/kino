import { ActivityFeed } from '@/components/feed/activity-feed';
import Bell from '@/icons/bell';

import { FEED_ITEMS } from './dashboard-mock-data';

// The primary dashboard column: a merged feed of updates from across the
// projects a user follows. Design/style mirror the Project Overview activity
// feed (shared `ActivityFeed`). Data is placeholder until a real cross-project
// updates query exists.
export function DashboardFeed() {
	return (
		<section className='flex flex-col gap-4'>
			<div className='flex items-center justify-between gap-2'>
				<div className='flex items-center gap-2'>
					<Bell className='size-4 text-muted-foreground' />
					<h2 className='text-sm font-semibold'>Your feed</h2>
				</div>
				<span className='text-xs text-muted-foreground'>Following coming soon</span>
			</div>

			{FEED_ITEMS.length === 0 ? (
				<div className='rounded-lg border border-dashed border-border p-10 text-center'>
					<Bell className='mx-auto size-6 text-muted-foreground/60' />
					<h3 className='mt-3 text-sm font-medium'>Nothing here yet</h3>
					<p className='mt-1.5 text-sm text-muted-foreground'>
						Updates from projects you follow will show up here.
					</p>
				</div>
			) : (
				// Each row is about the org the activity happened in; the author sits
				// below in the meta line rather than leading the row.
				<ActivityFeed
					items={FEED_ITEMS.map((item) => ({
						id: item.id,
						kind: item.kind,
						when: item.when,
						href: item.href,
						avatarLabel: item.org,
						primary: <span className='font-semibold'>{item.org}</span>,
						secondary: `“${item.title}”`,
						meta: item.author,
					}))}
				/>
			)}
		</section>
	);
}
