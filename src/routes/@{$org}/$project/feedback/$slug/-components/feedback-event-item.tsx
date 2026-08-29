import type { FeedbackEventData } from '../-types';

import { memo } from 'react';
import { Link } from '@tanstack/react-router';
import {
	ArrowRightLeft,
	Check,
	CheckCircle2,
	CircleX,
	FolderInput,
	SignalHigh,
	Tag,
	UserMinus,
	UserPlus,
} from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusIcon } from '@/icons';
import { formatFullDate, formatRelativeDay, toTimestamp } from '@/lib/utils/format-timestamp';
import * as m from '@/paraglide/messages.js';

// Memoized: timeline event rows take only the stable `event` prop, so they
// skip re-rendering when unrelated top-level state (dialogs, sheets) changes.
export const FeedbackEventItem = memo(function ({
	event,
	isLast = false,
}: {
	event: FeedbackEventData;
	isLast?: boolean;
}) {
	const Icon = getEventIcon(event.eventType);
	const createdAt = toTimestamp(event.createdAt);

	return (
		<li className='relative z-10 flex items-start gap-3 py-2 pl-4'>
			{/* When this event is the last row, the shared timeline rail (the `before`
			    line on the parent <ul>) would otherwise trail past the icon down to the
			    bottom of the list. Mask it from the icon's vertical center down so the
			    line's end tucks behind the icon. The icon wrapper below is `relative`
			    so it paints ON TOP of this mask (positioned siblings paint in DOM order),
			    keeping the mask behind the icon rather than notching it. */}
			{isLast ? (
				<span
					aria-hidden
					className='pointer-events-none absolute top-5 bottom-0 left-8 w-1 bg-background'
				/>
			) : null}
			<div className='relative ml-0.5 flex h-6 w-8 shrink-0 items-center justify-center'>
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
					<span className='font-medium text-foreground'>{m.feedback_someone()}</span>
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
		case 'priority_changed':
			return SignalHigh;
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
					{m.feedback_changed_status_from()} <StatusPill status={metadata?.oldValue} />{' '}
					{m.feedback_to()} <StatusPill status={metadata?.newValue} />
				</span>
			);
		case 'priority_changed':
			return (
				<span className='inline-flex flex-wrap items-center gap-1'>
					{m.feedback_changed_priority_from()} <PriorityPill priority={metadata?.oldValue} />{' '}
					{m.feedback_to()} <PriorityPill priority={metadata?.newValue} />
				</span>
			);
		case 'board_changed':
			return (
				<span>
					{m.feedback_moved_to_board()}{' '}
					<span className='rounded bg-muted px-1.5 py-0.5 text-xs font-medium'>
						{metadata?.newValue ?? m.feedback_unknown()}
					</span>
				</span>
			);
		case 'title_changed':
			return (
				<span>
					{m.feedback_changed_title_from()}{' '}
					<span className='rounded bg-muted px-1.5 py-0.5 text-xs font-medium'>
						{metadata?.oldValue ?? m.feedback_untitled()}
					</span>{' '}
					{m.feedback_to()}{' '}
					<span className='rounded bg-muted px-1.5 py-0.5 text-xs font-medium'>
						{metadata?.newValue ?? m.feedback_untitled()}
					</span>
				</span>
			);
		case 'assigned':
			return (
				<span>
					{m.feedback_assigned()}{' '}
					{targetProfile ? (
						<Link
							className='font-medium hocus:underline'
							params={{ username: targetProfile.username }}
							to='/u/$username'
						>
							@{targetProfile.username}
						</Link>
					) : (
						<span className='text-muted-foreground'>{m.feedback_unknown_user()}</span>
					)}
				</span>
			);
		case 'unassigned':
			return (
				<span>
					{m.feedback_unassigned_action()}{' '}
					{targetProfile ? (
						<Link
							className='font-medium hocus:underline'
							params={{ username: targetProfile.username }}
							to='/u/$username'
						>
							@{targetProfile.username}
						</Link>
					) : (
						<span className='text-muted-foreground'>{m.feedback_unknown_user()}</span>
					)}
				</span>
			);
		case 'answer_marked':
			return <span>{m.feedback_marked_comment_answer()}</span>;
		case 'answer_unmarked':
			return <span>{m.feedback_unmarked_answer()}</span>;
		default:
			return <span>{m.feedback_made_change()}</span>;
	}
}

const PRIORITY_DOT_CLASS: Record<string, string> = {
	high: 'bg-orange-500',
	low: 'bg-sky-500',
	medium: 'bg-amber-500',
	none: 'bg-muted-foreground/40',
	urgent: 'bg-red-500',
};

function PriorityPill({ priority }: { priority?: string | null }) {
	const value = priority ?? 'none';
	return (
		<span className='inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5'>
			<span
				className={`size-2 rounded-full ${PRIORITY_DOT_CLASS[value] ?? PRIORITY_DOT_CLASS.none}`}
			/>
			<span className='text-xs font-medium capitalize'>{value}</span>
		</span>
	);
}

function StatusPill({ status }: { status?: string | null }) {
	return (
		<span className='inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5'>
			{status ? <StatusIcon colored size='12' status={status as never} /> : null}
			<span className='text-xs font-medium'>{status ?? 'none'}</span>
		</span>
	);
}
