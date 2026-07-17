import type { FeedbackEventData } from '../-types';

import { memo } from 'react';
import { Link } from '@tanstack/react-router';
import {
	ArrowRightLeft,
	Check,
	CheckCircle2,
	CircleX,
	FolderInput,
	Tag,
	UserMinus,
	UserPlus,
} from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusIcon } from '@/icons';
import { formatFullDate, formatRelativeDay, toTimestamp } from '@/lib/utils/format-timestamp';

// Memoized: timeline event rows take only the stable `event` prop, so they
// skip re-rendering when unrelated top-level state (dialogs, sheets) changes.
export const FeedbackEventItem = memo(function FeedbackEventItem({
	event,
}: {
	event: FeedbackEventData;
}) {
	const Icon = getEventIcon(event.eventType);
	const createdAt = toTimestamp(event.createdAt);

	return (
		<li className='relative z-10 flex items-start gap-3 py-2 pl-4'>
			<div className='ml-0.5 flex h-6 w-8 shrink-0 items-center justify-center'>
				<div className='flex h-6 w-6 items-center justify-center rounded-full border bg-muted'>
					<Icon className='h-3 w-3 text-muted-foreground' />
				</div>
			</div>
			<div className='flex min-w-0 flex-1 flex-wrap items-center gap-x-1 text-sm text-muted-foreground'>
				{event.actor ? (
					<Link
						className='font-medium text-foreground hocus:underline'
						params={{ username: event.actor.username }}
						to='/u/$username'
					>
						@{event.actor.username}
					</Link>
				) : (
					<span className='font-medium text-foreground'>Someone</span>
				)}{' '}
				{getEventDescription(event)}{' '}
				<Tooltip>
					<TooltipTrigger asChild delay={100}>
						<span
							className='cursor-pointer border-b border-dotted border-foreground/30 text-foreground/50'
							suppressHydrationWarning
						>
							{formatRelativeDay(createdAt)}
						</span>
					</TooltipTrigger>
					<TooltipContent>
						<span suppressHydrationWarning>{formatFullDate(createdAt)}</span>
					</TooltipContent>
				</Tooltip>
			</div>
		</li>
	);
});

function getEventIcon(eventType: FeedbackEventData['eventType']) {
	switch (eventType) {
		case 'status_changed':
			return ArrowRightLeft;
		case 'board_changed':
			return FolderInput;
		case 'title_changed':
			return Tag;
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

function getEventDescription(event: FeedbackEventData) {
	const { eventType, metadata, targetProfile } = event;

	switch (eventType) {
		case 'status_changed':
			return (
				<span className='inline-flex flex-wrap items-center gap-1'>
					changed status from <StatusPill status={metadata?.oldValue} /> to{' '}
					<StatusPill status={metadata?.newValue} />
				</span>
			);
		case 'board_changed':
			return (
				<span>
					moved to board{' '}
					<span className='rounded bg-muted px-1.5 py-0.5 text-xs font-medium'>
						{metadata?.newValue ?? 'Unknown'}
					</span>
				</span>
			);
		case 'title_changed':
			return (
				<span>
					changed title from{' '}
					<span className='rounded bg-muted px-1.5 py-0.5 text-xs font-medium'>
						{metadata?.oldValue ?? 'Untitled'}
					</span>{' '}
					to{' '}
					<span className='rounded bg-muted px-1.5 py-0.5 text-xs font-medium'>
						{metadata?.newValue ?? 'Untitled'}
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
							params={{ username: targetProfile.username }}
							to='/u/$username'
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
							params={{ username: targetProfile.username }}
							to='/u/$username'
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

function StatusPill({ status }: { status?: string | null }) {
	return (
		<span className='inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5'>
			{status ? <StatusIcon colored size='12' status={status as never} /> : null}
			<span className='text-xs font-medium'>{status ?? 'none'}</span>
		</span>
	);
}
