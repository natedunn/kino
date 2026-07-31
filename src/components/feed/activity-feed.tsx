import type { Icon as IconType } from '@/icons/types';
import type { ReactNode } from 'react';

import ArchivePencil from '@/icons/archive-pencil';
import CalendarDays from '@/icons/calendar-days';
import CirclePlay from '@/icons/circle-play';
import Github from '@/icons/github';
import Interview from '@/icons/interview';
import { cn } from '@/lib/utils';

// Kinds of activity a feed row can represent. Shared by the Project Overview
// activity feed and the global dashboard feed so both stay visually in sync.
export type ActivityKind =
	| 'feedback_created'
	| 'feedback_status_changed'
	| 'update_published'
	| 'member_joined'
	| 'github_linked';

export interface ActivityFeedItem {
	id: string;
	kind: ActivityKind;
	/** Human time label, e.g. "2h ago". */
	when: string;
	/** Text used to derive the monogram initials in the avatar rail. */
	avatarLabel: string;
	/** Bold primary line — the subject the row is about. */
	primary: ReactNode;
	/** Optional muted line beneath the primary (e.g. the thing that happened). */
	secondary?: ReactNode;
	/** Optional extra meta shown before the type · time row (e.g. the author). */
	meta?: ReactNode;
	/**
	 * Optional render callback; when provided the row becomes a link. The caller
	 * supplies the link element (e.g. a TanStack Router `<Link>`) so navigation
	 * stays typed and constrained to known routes.
	 */
	renderLink?: (children: ReactNode) => ReactNode;
}

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

function initials(label: string) {
	return label
		.split(' ')
		.map((part) => part.charAt(0))
		.slice(0, 2)
		.join('')
		.toUpperCase();
}

// A vertical timeline of activity cards. Mirrors the comment thread: a connector
// line (before:) runs through the avatars at left-[33px], with each event as its
// own card. Used on the Project Overview page and the global dashboard.
export function ActivityFeed({ items }: { items: Array<ActivityFeedItem> }) {
	return (
		<ul
			className={cn(
				'relative flex flex-col gap-6',
				items.length > 1 &&
					'before:absolute before:top-0 before:bottom-0 before:left-[33px] before:z-0 before:border-r before:border-border'
			)}
		>
			{items.map((event) => {
				const config = ACTIVITY_CONFIG[event.kind];
				const { Icon } = config;
				const body = (
					<div className='flex w-full min-w-0'>
						{/* Avatar rail — same as the comment card */}
						<div className='flex shrink-0 flex-col items-center justify-start border-r bg-accent pt-3 pl-4'>
							<div className='relative -mr-4 flex size-8 items-center justify-center overflow-hidden rounded-full border bg-primary text-xs font-bold text-primary-foreground shadow-xl shadow-black'>
								{initials(event.avatarLabel)}
							</div>
						</div>

						{/* Body — the subject on top, then an optional detail line, then
					    the meta row (author · type · time). */}
						<div className='flex w-full min-w-0 flex-col justify-center bg-card py-4 pr-5 pl-7'>
							<p className='leading-snug'>{event.primary}</p>
							{event.secondary ? (
								<p className='mt-0.5 leading-snug text-muted-foreground'>{event.secondary}</p>
							) : null}
							<div className='mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground'>
								{event.meta ? (
									<>
										<span>{event.meta}</span>
										<span aria-hidden>·</span>
									</>
								) : null}
								<span
									className={cn('inline-flex items-center gap-1 font-medium', config.colorClass)}
								>
									<Icon className='size-3' />
									{config.label}
								</span>
								<span aria-hidden>·</span>
								<span>{event.when}</span>
							</div>
						</div>
					</div>
				);

				return (
					<li
						key={event.id}
						className='relative z-10 flex overflow-hidden rounded-lg border bg-card'
					>
						{event.renderLink
							? event.renderLink(
									<div className='flex w-full min-w-0 transition-colors hover:bg-accent/30'>
										{body}
									</div>
								)
							: body}
					</li>
				);
			})}
		</ul>
	);
}
