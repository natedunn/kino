import { createFileRoute } from '@tanstack/react-router';
import { Bell } from 'lucide-react';

import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/account/notifications/')({
	head: () => ({
		meta: [titleMeta(['Notifications', 'Account'])],
	}),
	component: NotificationsRoute,
});

function NotificationsRoute() {
	return (
		<section className='max-w-3xl'>
			<header className='border-b pb-4'>
				<h2 className='text-xl font-semibold'>Notifications</h2>
				<p className='mt-1 text-sm text-muted-foreground'>
					Decide which updates Kino sends you and where.
				</p>
			</header>

			<div className='mt-6 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center'>
				<div className='flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground'>
					<Bell className='size-5' />
				</div>
				<p className='font-medium'>Notification preferences are coming soon</p>
				<p className='max-w-sm text-sm text-muted-foreground'>
					You'll be able to choose email and in-app alerts for mentions, assignments, and project
					activity here.
				</p>
			</div>
		</section>
	);
}
