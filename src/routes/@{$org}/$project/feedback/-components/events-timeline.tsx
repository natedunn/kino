import { Link } from '@tanstack/react-router';
import {
	ArrowRightLeft,
	Check,
	CheckCircle2,
	CircleX,
	FolderInput,
	UserMinus,
	UserPlus,
} from 'lucide-react';

import { API } from '~api';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusIcon } from '@/icons';
import { cn } from '@/lib/utils';
import { formatFullDate, formatRelativeDay } from '@/lib/utils/format-timestamp';

type FeedbackEvent = NonNullable<API['feedbackEvent']['listByFeedback']>[number];

type EventItemProps = {
	event: FeedbackEvent;
};

function getEventIcon(eventType: FeedbackEvent['eventType']) {
	switch (eventType) {
		case 'status_changed':
			return ArrowRightLeft;
		case 'board_changed':
			return FolderInput;
		case 'assigned':
			return UserPlus;
		case 'unassigned':
			return UserMinus;
		case 'answer_marked':
			return CheckCircle2;
		case 'answer_unmarked':
			return CircleX;
		default:
			return Check;
	}
}

function getEventDescription(event: FeedbackEvent): React.ReactNode {
	const { eventType, metadata, targetProfile } = event;

	switch (eventType) {
		case 'status_changed':
			return (
				<span className='inline-flex flex-wrap items-center gap-1'>
					changed status from{' '}
					<span className='inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5'>
						<StatusIcon
							status={metadata?.oldValue as 'open' | 'in-progress' | 'closed' | 'completed' | 'paused'}
							size='12'
							colored
						/>
						<span className='text-xs font-medium'>{metadata?.oldValue}</span>
					</span>{' '}
					to{' '}
					<span className='inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5'>
						<StatusIcon
							status={metadata?.newValue as 'open' | 'in-progress' | 'closed' | 'completed' | 'paused'}
							size='12'
							colored
						/>
						<span className='text-xs font-medium'>{metadata?.newValue}</span>
					</span>
				</span>
			);

		case 'board_changed':
			return (
				<span>
					moved to board{' '}
					<span className='rounded bg-muted px-1.5 py-0.5 text-xs font-medium'>
						{metadata?.newValue}
					</span>
				</span>
			);

		case 'assigned':
			return (
				<span>
					assigned{' '}
					{targetProfile ? (
						<Link
							className='font-medium hocus:underline'
							to='/@{$org}'
							params={{ org: targetProfile.username }}
						>
							@{targetProfile.username}
						</Link>
					) : (
						<span className='text-muted-foreground'>unknown user</span>
					)}
				</span>
			);

		case 'unassigned':
			return (
				<span>
					unassigned{' '}
					{targetProfile ? (
						<Link
							className='font-medium hocus:underline'
							to='/@{$org}'
							params={{ org: targetProfile.username }}
						>
							@{targetProfile.username}
						</Link>
					) : (
						<span className='text-muted-foreground'>unknown user</span>
					)}
				</span>
			);

		case 'answer_marked':
			return <span>marked a comment as the answer</span>;

		case 'answer_unmarked':
			return <span>unmarked the answer</span>;

		default:
			return <span>made a change</span>;
	}
}

function EventItem({ event }: EventItemProps) {
	const { actor } = event;
	const Icon = getEventIcon(event.eventType);

	return (
		<li className='flex items-start gap-3 py-2'>
			<div className='flex h-6 w-8 shrink-0 items-center justify-center'>
				<div className='flex h-6 w-6 items-center justify-center rounded-full border bg-muted'>
					<Icon className='h-3 w-3 text-muted-foreground' />
				</div>
			</div>
			<div className='flex min-w-0 flex-1 flex-wrap items-center gap-x-1 text-sm text-muted-foreground'>
				{actor ? (
					<Link className='font-medium text-foreground hocus:underline' to='/@{$org}' params={{ org: actor.username }}>
						@{actor.username}
					</Link>
				) : (
					<span className='font-medium'>Someone</span>
				)}{' '}
				{getEventDescription(event)}{' '}
				<Tooltip>
					<TooltipTrigger asChild delay={100}>
						<span
							className='cursor-pointer border-b border-dotted border-foreground/30 text-foreground/50'
							suppressHydrationWarning
						>
							{formatRelativeDay(event._creationTime)}
						</span>
					</TooltipTrigger>
					<TooltipContent>
						<span suppressHydrationWarning>{formatFullDate(event._creationTime)}</span>
					</TooltipContent>
				</Tooltip>
			</div>
		</li>
	);
}

type EventsTimelineProps = {
	events: FeedbackEvent[];
	className?: string;
};

export function EventsTimeline({ events, className }: EventsTimelineProps) {
	if (events.length === 0) {
		return null;
	}

	return (
		<ul className={cn('flex flex-col', className)}>
			{events.map((event) => (
				<EventItem key={event._id} event={event} />
			))}
		</ul>
	);
}
