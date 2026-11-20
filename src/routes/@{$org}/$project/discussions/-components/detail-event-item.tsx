import type { FunctionReturnType } from 'convex/server';
import type { ReactNode } from 'react';
import type { api as nativeApi } from '../../../../../../convex/native/_generated/api';

import { memo } from 'react';
import { Link } from '@tanstack/react-router';
import {
	ArrowRightLeft,
	CircleCheck,
	CircleX,
	FolderInput,
	Lock,
	LockOpen,
	Pin,
	PinOff,
	Tag,
} from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusIcon } from '@/icons';
import { formatFullDate, formatRelativeDay } from '@/lib/utils/format-timestamp';
import * as m from '@/paraglide/messages.js';

export type DiscussionEvent = NonNullable<
	FunctionReturnType<typeof nativeApi.discussions.detail>
>['events'][number];

// Mirrors the Feedback timeline event row so both threads read the same way.
export const DetailEventItem = memo(function ({
	event,
	isLast = false,
	params,
}: {
	event: DiscussionEvent;
	isLast?: boolean;
	params: { org: string; project: string };
}) {
	const Icon = EVENT_ICONS[event.eventType];
	return (
		<li className='relative z-10 flex items-start gap-3 py-2 pl-4'>
			{/* Tuck the end of the thread rail behind the icon on the last row. */}
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
				{describe(event, params)}{' '}
				<Tooltip>
					<TooltipTrigger asChild delay={100}>
						<span
							className='cursor-pointer border-b border-dotted border-foreground/30 text-foreground/50'
							suppressHydrationWarning
						>
							{formatRelativeDay(event.createdAt)}
						</span>
					</TooltipTrigger>
					<TooltipContent>
						<span suppressHydrationWarning>{formatFullDate(event.createdAt)}</span>
					</TooltipContent>
				</Tooltip>
			</div>
		</li>
	);
});

const EVENT_ICONS = {
	title_changed: Tag,
	category_changed: FolderInput,
	pinned: Pin,
	unpinned: PinOff,
	locked: Lock,
	unlocked: LockOpen,
	answer_marked: CircleCheck,
	answer_unmarked: CircleX,
	converted_to_feedback: ArrowRightLeft,
} satisfies Record<DiscussionEvent['eventType'], unknown>;

function Pill({ children }: { children: ReactNode }) {
	return <span className='rounded bg-muted px-1.5 py-0.5 text-xs font-medium'>{children}</span>;
}

function describe(event: DiscussionEvent, params: { org: string; project: string }) {
	switch (event.eventType) {
		case 'title_changed':
			return (
				<span>
					{m.feedback_changed_title_from()} <Pill>{event.oldValue ?? m.feedback_untitled()}</Pill>{' '}
					{m.feedback_to()} <Pill>{event.newValue ?? m.feedback_untitled()}</Pill>
				</span>
			);
		case 'category_changed':
			return event.oldValue ? (
				<span>
					{m.discussions_detail_event_moved_from()} <Pill>{event.oldValue}</Pill> {m.feedback_to()}{' '}
					<Pill>{event.newValue ?? m.feedback_unknown()}</Pill>
				</span>
			) : (
				<span>
					{m.discussions_detail_event_moved_to()}{' '}
					<Pill>{event.newValue ?? m.feedback_unknown()}</Pill>
				</span>
			);
		case 'pinned':
			return <span>{m.discussions_detail_event_pinned()}</span>;
		case 'unpinned':
			return <span>{m.discussions_detail_event_unpinned()}</span>;
		case 'locked':
			return <span>{m.discussions_detail_event_locked()}</span>;
		case 'unlocked':
			return <span>{m.discussions_detail_event_unlocked()}</span>;
		case 'answer_marked':
			return <span>{m.discussions_detail_event_answer_marked()}</span>;
		case 'answer_unmarked':
			return <span>{m.discussions_detail_event_answer_unmarked()}</span>;
		case 'converted_to_feedback':
			return (
				<span className='inline-flex flex-wrap items-center gap-1'>
					{m.discussions_detail_event_converted()}
					{event.feedback ? (
						<Link
							className='link-text inline-flex items-center gap-1 font-medium'
							params={{ ...params, slug: event.feedback.slug }}
							to='/@{$org}/$project/feedback/$slug'
						>
							<StatusIcon colored size='12' status={event.feedback.status} />
							{event.feedback.title}
						</Link>
					) : null}
				</span>
			);
	}
}
