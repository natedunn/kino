import type { Id } from '../../../../../../convex/native/_generated/dataModel';

import { useEffect, useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Lightbulb, X } from 'lucide-react';

import { InlineAlert } from '@/components/inline-alert';
import { Button } from '@/components/ui/button';
import { FORM_LIMITS } from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

import { api as nativeApi } from '../../../../../../convex/native/_generated/api';
import { SimilarFeedbackList, SimilarTopicList } from './similar-topics';

// Wait for a pause in typing, and for enough of a title to match on.
const SEARCH_DEBOUNCE_MS = 300;
const MIN_SEARCH_CHARS = 3;
const HINT_DISMISSED_PREFIX = 'kino:forum-feedback-hint-dismissed:';

type RouteParams = { org: string; project: string };

function readDismissed(projectId: string) {
	try {
		return window.localStorage.getItem(`${HINT_DISMISSED_PREFIX}${projectId}`) === '1';
	} catch {
		return false;
	}
}

function writeDismissed(projectId: string) {
	try {
		window.localStorage.setItem(`${HINT_DISMISSED_PREFIX}${projectId}`, '1');
	} catch {
		// Storage can be blocked; the tip then just stays hidden for this visit.
	}
}

/**
 * Shown under the title while a topic is being written: existing topics and
 * feedback that match it, and a gentle pointer to Feedback for bug reports and
 * feature requests. Never blocks posting.
 */
export function NewTopicSuggestions({
	categoryFormat,
	params,
	projectId,
	title,
}: {
	/** The selected category's format; Q&A categories skip the generic tip. */
	categoryFormat: 'open' | 'qa' | undefined;
	params: RouteParams;
	projectId: Id<'projects'>;
	title: string;
}) {
	const [debouncedTitle, setDebouncedTitle] = useState(title);
	// Unknown until read from storage after mount, so the tip never flashes.
	const [dismissed, setDismissed] = useState<boolean | null>(null);

	useEffect(() => {
		const timeout = setTimeout(() => setDebouncedTitle(title), SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timeout);
	}, [title]);

	useEffect(() => {
		setDismissed(readDismissed(projectId));
	}, [projectId]);

	const term = debouncedTitle.trim().slice(0, FORM_LIMITS.forumSearch);
	const searching = term.length >= MIN_SEARCH_CHARS;
	const suggestionsQuery = useQuery({
		...convexQuery(
			nativeApi.forumSimilar.suggestions,
			searching ? { projectId, title: term } : 'skip'
		),
		// Keep the last matches on screen while the next search runs.
		placeholderData: keepPreviousData,
	});
	// The feedback form needs a board to post into.
	const boardsQuery = useQuery(convexQuery(nativeApi.feedbackBoards.list, { projectId }));
	const feedbackAvailable = !!boardsQuery.data?.length;

	const suggestions = searching ? suggestionsQuery.data : undefined;
	const topics = suggestions?.topics ?? [];
	const feedback = suggestions?.feedback ?? [];
	const feedbackTitle = title.trim().slice(0, FORM_LIMITS.feedbackTitle);
	const feedbackLink = feedbackAvailable ? (
		<Link
			className='link-text link-text-underline font-medium'
			params={params}
			search={feedbackTitle ? { title: feedbackTitle } : {}}
			to='/@{$org}/$project/feedback/new'
		>
			{m.forum_feedback_hint_action()}
		</Link>
	) : null;
	const showTip =
		feedbackAvailable && !feedback.length && categoryFormat !== 'qa' && dismissed === false;

	return (
		<>
			{topics.length || feedback.length ? (
				<div className='flex flex-col gap-3 rounded-lg border bg-muted/30 p-3'>
					<p className='text-xs text-muted-foreground'>{m.forum_similar_hint()}</p>
					{topics.length ? (
						<section className='flex flex-col gap-1'>
							<h2 className='text-xs font-semibold text-muted-foreground'>
								{m.forum_similar_topics()}
							</h2>
							<SimilarTopicList items={topics} newTab params={params} />
						</section>
					) : null}
					{feedback.length ? (
						<section className='flex flex-col gap-1'>
							<h2 className='text-xs font-semibold text-muted-foreground'>
								{m.forum_similar_feedback()}
							</h2>
							<SimilarFeedbackList items={feedback} params={params} />
							{feedbackLink ? (
								<p className='mt-1 text-xs text-muted-foreground'>
									{m.forum_feedback_hint_question()} {feedbackLink}
								</p>
							) : null}
						</section>
					) : null}
				</div>
			) : null}
			{showTip ? (
				<InlineAlert className='flex items-start gap-2' size='sm'>
					<Lightbulb
						aria-hidden='true'
						className='mt-0.5 size-3.5 shrink-0 text-muted-foreground'
					/>
					<p className='flex-1 text-muted-foreground'>
						{m.forum_feedback_hint_question()} {feedbackLink}
					</p>
					<Button
						aria-label={m.forum_feedback_hint_dismiss()}
						className='-my-1 size-6 shrink-0'
						onClick={() => {
							writeDismissed(projectId);
							setDismissed(true);
						}}
						size='icon-sm'
						title={m.forum_feedback_hint_dismiss()}
						type='button'
						variant='ghost'
					>
						<X className='size-3.5' />
					</Button>
				</InlineAlert>
			) : null}
		</>
	);
}
