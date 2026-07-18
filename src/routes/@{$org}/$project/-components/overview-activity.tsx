import { MOCK_ACTIVITY } from '../-overview-mock-data';
import type { Icon as IconType } from '@/icons/types';
import type { ActivityKind } from '../-overview-types';

import ArchivePencil from '@/icons/archive-pencil';
import Bell from '@/icons/bell';
import CalendarDays from '@/icons/calendar-days';
import CirclePlay from '@/icons/circle-play';
import Github from '@/icons/github';
import Interview from '@/icons/interview';
import { cn } from '@/lib/utils';


const ACTIVITY_CONFIG: Record<ActivityKind, { label: string; Icon: IconType; colorClass: string }> =
	{
		update_published: {
			label: 'Update',
			Icon: CalendarDays,
			colorClass: 'text-emerald-500 dark:text-emerald-400',
		},
		feedback_status_changed: {
			label: 'Status',
			Icon: CirclePlay,
			colorClass: 'text-violet-500 dark:text-violet-400',
		},
		feedback_created: {
			label: 'Feedback',
			Icon: ArchivePencil,
			colorClass: 'text-blue-500 dark:text-blue-400',
		},
		github_linked: {
			label: 'GitHub',
			Icon: Github,
			colorClass: 'text-foreground',
		},
		member_joined: {
			label: 'Member',
			Icon: Interview,
			colorClass: 'text-amber-500 dark:text-amber-400',
		},
	};

function initials(name: string) {
	return name
		.split(' ')
		.map((part) => part.charAt(0))
		.slice(0, 2)
		.join('')
		.toUpperCase();
}

export function OverviewActivity() {
	return (
		<section className='flex flex-col gap-4'>
			<div className='flex items-center gap-2'>
				<Bell className='size-4 text-muted-foreground' />
				<h2 className='text-sm font-semibold'>Activity</h2>
			</div>

			{/* Mirrors the comment thread: a vertical connector line (before:) runs
          through the avatars at left-[33px], with each event as its own card. */}
			<ul
				className={cn(
					'relative flex flex-col gap-6',
					MOCK_ACTIVITY.length > 1 &&
						'before:absolute before:top-0 before:bottom-0 before:left-[33px] before:z-0 before:border-r before:border-border'
				)}
			>
				{MOCK_ACTIVITY.map((event) => {
					const config = ACTIVITY_CONFIG[event.kind];
					const { Icon } = config;
					return (
						<li
							key={event.id}
							className='relative z-10 flex overflow-hidden rounded-lg border bg-card'
						>
							<div className='flex w-full min-w-0'>
								{/* Avatar rail — same as the comment card */}
								<div className='flex shrink-0 flex-col items-center justify-start border-r bg-accent pt-3 pl-4'>
									<div className='relative -mr-4 flex size-8 items-center justify-center overflow-hidden rounded-full border bg-primary text-xs font-bold text-primary-foreground shadow-xl shadow-black'>
										{initials(event.actor)}
									</div>
								</div>

								{/* Body — one inline block: actor + summary on a line, then
                    the activity type and time below. */}
								<div className='flex w-full min-w-0 flex-col justify-center bg-card py-4 pr-5 pl-7'>
									<p className='leading-snug'>
										<span className='font-semibold'>{event.actor}</span>{' '}
										<span className='text-muted-foreground'>{event.summary}</span>
									</p>
									<div className='mt-3 flex items-center gap-1.5 text-xs text-muted-foreground'>
										<span
											className={cn(
												'inline-flex items-center gap-1 font-medium',
												config.colorClass
											)}
										>
											<Icon className='size-3' />
											{config.label}
										</span>
										<span aria-hidden>·</span>
										<span>{event.when}</span>
									</div>
								</div>
							</div>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
