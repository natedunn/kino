import { zid } from 'convex-helpers/server/zod';
import { z } from 'zod';

import { SHARED_SCHEMA } from './_shared';

export const feedbackComment = z.object({
	...SHARED_SCHEMA('feedbackComment'),
	feedbackId: zid('feedback'),
	authorProfileId: zid('profile'),
	replyFeedbackCommentId: zid('feedbackComment').optional(),
	content: z.string().min(1).max(1200),
	// emoteCounts: z.record(feedbackCommentEmotes.shape.content, z.number().optional()),
});

export const feedbackCommentSelectSchema = feedbackComment;
export const feedbackCommentCreateSchema = feedbackComment.pick({
	feedbackId: true,
	content: true,
});

export type FeedbackComment = z.infer<typeof feedbackComment>;
export type FeedbackCommentSelectSchema = z.infer<typeof feedbackCommentSelectSchema>;
export type FeedbackCommentCreateSchema = z.infer<typeof feedbackCommentCreateSchema>;
