import type { FunctionReturnType } from 'convex/server';
import type { api as nativeApi } from '../../../../../../convex/native/_generated/api';

import { Link } from '@tanstack/react-router';
import { MessageSquare } from 'lucide-react';

import { BoardIcon } from '@/components/board-icon';
import { StatusIcon } from '@/icons';
import * as m from '@/paraglide/messages.js';

export type SimilarTopic = FunctionReturnType<typeof nativeApi.forumSimilar.similarTopics>[number];
export type SimilarFeedback = FunctionReturnType<
	typeof nativeApi.forumSimilar.suggestions
>['feedback'][number];

type RouteParams = { org: string; project: string };

const ROW =
	'flex min-w-0 items-center gap-2.5 rounded-md px-1 py-1.5 transition-colors hover:bg-muted/50';

// New-tab links keep an unsaved form (category, poll, body) intact.
function newTabProps(newTab: boolean) {
	return newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {};
}

function NewTabNote({ newTab }: { newTab: boolean }) {
	return newTab ? <span className='sr-only'>{m.forum_similar_new_tab()}</span> : null;
}

/** Compact topic rows: category icon, title and reply count. */
export function SimilarTopicList({
	items,
	newTab = false,
	params,
}: {
	items: Array<SimilarTopic>;
	newTab?: boolean;
	params: RouteParams;
}) {
	return (
		<ul className='flex flex-col'>
			{items.map((item) => (
				<li key={item.id}>
					<Link
						{...newTabProps(newTab)}
						className={ROW}
						params={{ ...params, slug: item.slug }}
						preload={newTab ? false : 'intent'}
						to='/@{$org}/$project/forum/$slug'
					>
						{item.category ? (
							<span className='inline-flex shrink-0' title={item.category.name}>
								<BoardIcon icon={item.category.icon} name={item.category.name} size='14px' />
								<span className='sr-only'>{item.category.name}</span>
							</span>
						) : (
							<MessageSquare aria-hidden='true' className='size-3.5 shrink-0' />
						)}
						<span className='flex-1 truncate text-sm'>{item.title}</span>
						<span className='flex shrink-0 items-center gap-1 text-xs text-muted-foreground'>
							<MessageSquare aria-hidden='true' className='size-3' />
							<span className='sr-only'>{m.forum_reply_count({ count: item.commentCount })}</span>
							<span aria-hidden='true'>{item.commentCount}</span>
						</span>
						<NewTabNote newTab={newTab} />
					</Link>
				</li>
			))}
		</ul>
	);
}

/** Compact feedback rows with their status, opened in a new tab. */
export function SimilarFeedbackList({
	items,
	params,
}: {
	items: Array<SimilarFeedback>;
	params: RouteParams;
}) {
	return (
		<ul className='flex flex-col'>
			{items.map((item) => (
				<li key={item.id}>
					<Link
						{...newTabProps(true)}
						className={ROW}
						params={{ ...params, slug: item.slug }}
						preload={false}
						to='/@{$org}/$project/feedback/$slug'
					>
						<StatusIcon colored size='14' status={item.status} />
						<span className='flex-1 truncate text-sm'>{item.title}</span>
						<NewTabNote newTab />
					</Link>
				</li>
			))}
		</ul>
	);
}
