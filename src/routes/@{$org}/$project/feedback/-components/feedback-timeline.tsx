import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';

import { api, API } from '~api';
import { Id } from '@/convex/_generated/dataModel';

import { EventsTimeline } from './events-timeline';
import { FeedbackComment } from './feedback-comment';

type Comment = NonNullable<API['feedbackComment']['listByFeedback']>[number];
type FeedbackEvent = NonNullable<API['feedbackEvent']['listByFeedback']>[number];

type TimelineItem = { type: 'comment'; data: Comment } | { type: 'event'; data: FeedbackEvent };

type FeedbackTimelineProps = {
	feedback: {
		_id: Id<'feedback'>;
		authorProfileId: Id<'profile'>;
		answerCommentId?: Id<'feedbackComment'>;
	};
	events: FeedbackEvent[];
	currentProfileId?: Id<'profile'>;
	canMarkAnswer?: boolean;
};

export function FeedbackTimeline({
	feedback,
	events,
	currentProfileId,
	canMarkAnswer,
}: FeedbackTimelineProps) {
	const { data: comments } = useSuspenseQuery(
		convexQuery(api.feedbackComment.listByFeedback, { feedbackId: feedback._id })
	);

	// Filter out the initial comment (shown separately)
	const additionalComments = comments?.filter((c) => !c.initial) ?? [];

	// Create unified timeline of comments and events
	const timelineItems: TimelineItem[] = [
		...additionalComments.map((comment) => ({ type: 'comment' as const, data: comment })),
		...events.map((event) => ({ type: 'event' as const, data: event })),
	].sort((a, b) => a.data._creationTime - b.data._creationTime);

	if (timelineItems.length === 0) {
		return null;
	}

	return (
		<ul className='mt-6 flex flex-col gap-6'>
			{timelineItems.map((item) =>
				item.type === 'comment' ? (
					<FeedbackComment
						key={item.data._id}
						variant='reply'
						comment={item.data}
						feedback={feedback}
						currentProfileId={currentProfileId}
						isAnswer={feedback.answerCommentId === item.data._id}
						canMarkAnswer={canMarkAnswer}
					/>
				) : (
					<li key={item.data._id} className='relative'>
						<EventsTimeline events={[item.data]} />
					</li>
				)
			)}
		</ul>
	);
}
