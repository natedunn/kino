import type { DiscussionDetail } from './detail-sidebar';

import { Link } from '@tanstack/react-router';
import { ArrowDown, CircleCheck } from 'lucide-react';

import { EditorContentDisplay } from '@/components/editor';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatRelativeDay } from '@/lib/utils/format-timestamp';
import * as m from '@/paraglide/messages.js';

// The accepted answer, surfaced right under the opening post. It's a summary
// copy: the reply itself stays in place in the thread (and owns the
// `comment-<id>` anchor), so this card only links down to it.
export function DetailAnswer({
	answer,
	onJump,
}: {
	answer: NonNullable<DiscussionDetail['answer']>;
	onJump: () => void;
}) {
	const username = answer.author?.username;

	return (
		<li className='relative z-10 flex flex-col overflow-hidden rounded-lg border border-green-500 bg-card dark:border-green-600'>
			<div className='flex flex-wrap items-center justify-between gap-2 border-b border-green-500/30 bg-green-500/5 px-6 py-3'>
				<div className='flex min-w-0 items-center gap-2 text-sm'>
					<span className='inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400'>
						<CircleCheck className='size-3' />
						{m.discussions_detail_answer()}
					</span>
					<Avatar className='size-5' fallbackName={username ?? m.feedback_unknown_user()}>
						<AvatarImage
							alt={username ?? m.feedback_unknown_user()}
							src={answer.author?.imageUrl ?? undefined}
						/>
						<AvatarFallback />
					</Avatar>
					{username ? (
						<Link className='hocus:underline' params={{ username }} to='/u/$username'>
							@{username}
						</Link>
					) : (
						<span className='text-muted-foreground'>{m.feedback_unknown_user()}</span>
					)}
					<span className='text-muted-foreground' suppressHydrationWarning>
						{formatRelativeDay(answer.creationTime)}
					</span>
				</div>
				<Button onClick={onJump} size='sm' variant='ghost'>
					<ArrowDown className='size-3.5' />
					{m.discussions_detail_jump_to_answer()}
				</Button>
			</div>
			<div className='min-w-0 p-6'>
				<EditorContentDisplay content={answer.content} />
			</div>
		</li>
	);
}
