import type { Id } from '../../../../../../convex/native/_generated/dataModel';

import { useEffect, useRef, useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMutation } from 'convex/react';

import * as m from '@/paraglide/messages.js';

import { api as nativeApi } from '../../../../../../convex/native/_generated/api';

// New replies arriving while the topic is open are marked read at most this often.
const MARK_THROTTLE = 5_000;

type VisitReadState = {
	topicId: Id<'forumTopics'>;
	// Replies after this were unread when the visit began; null when the viewer
	// had never read the topic (all of it is new, so there's nothing to divide).
	lastReadAt: number | null;
	unread: boolean;
};

/**
 * The viewer's read state as it was when they opened the topic, captured
 * before marking it read so the page can point at what's new. Marks the topic
 * read while it's visible, again (throttled) when new replies arrive.
 */
export function useTopicVisit(topicId: Id<'forumTopics'>, signedIn: boolean) {
	const { data: state } = useQuery(
		convexQuery(nativeApi.forumReads.topicState, signedIn ? { topicId } : 'skip')
	);
	const [visit, setVisit] = useState<VisitReadState | null>(null);
	// Captured during render so the mark below can never run first.
	if (state && visit?.topicId !== topicId)
		setVisit({ topicId, lastReadAt: state.lastReadAt, unread: state.unread });

	const markRead = useMutation(nativeApi.forumReads.markRead);
	const lastMark = useRef<{ topicId: Id<'forumTopics'>; at: number } | null>(null);
	const needsMark = visit?.topicId === topicId && state?.upToDate === false;
	useEffect(() => {
		if (!needsMark) return;
		let timer: number | undefined;
		// Background tabs don't count as reading; wait until the page is visible.
		const schedule = () => {
			window.clearTimeout(timer);
			if (document.visibilityState !== 'visible') return;
			const previous = lastMark.current?.topicId === topicId ? lastMark.current.at : 0;
			timer = window.setTimeout(
				() => {
					lastMark.current = { topicId, at: Date.now() };
					void markRead({ topicId }).catch(() => undefined);
				},
				Math.max(0, previous + MARK_THROTTLE - Date.now())
			);
		};
		schedule();
		document.addEventListener('visibilitychange', schedule);
		return () => {
			window.clearTimeout(timer);
			document.removeEventListener('visibilitychange', schedule);
		};
	}, [markRead, needsMark, topicId]);

	return visit?.topicId === topicId ? visit : null;
}

/** The first reply someone else posted after the viewer's last read. */
export function firstUnreadReply<T extends { creationTime: number; author: { id: string } | null }>(
	replies: Array<T>,
	visit: VisitReadState | null,
	viewerProfileId: string | null
) {
	const lastReadAt = visit?.lastReadAt;
	if (lastReadAt == null) return null;
	return (
		replies.find(
			(reply) => reply.creationTime > lastReadAt && reply.author?.id !== viewerProfileId
		) ?? null
	);
}

export function UnreadDivider() {
	return (
		<li className='relative z-10 flex items-center gap-3 bg-background py-1 text-xs font-semibold tracking-wide uppercase'>
			<span aria-hidden='true' className='h-px flex-1 bg-primary/60' />
			{m.forum_unread_divider()}
			<span aria-hidden='true' className='h-px flex-1 bg-primary/60' />
		</li>
	);
}
