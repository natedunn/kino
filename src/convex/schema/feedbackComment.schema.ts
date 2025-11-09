import * as z from 'zod';

import { zid } from '@/_modules/zod4';

import { SHARED_SCHEMA } from './_shared';

export const feedbackCommentSchema = z.object({
	...SHARED_SCHEMA('feedbackComment'),
	feedbackId: zid('feedback'),
	authorProfileId: zid('profile'),
	replyFeedbackCommentId: z.optional(zid('feedbackComment')),
	content: z.string().min(1).max(1200),
	// emoteCounts: z.record(feedbackCommentEmotes.shape.content, z.number().optional()),
});

export const feedbackCommentSelectSchema = feedbackCommentSchema;
export const feedbackCommentCreateSchema = feedbackCommentSchema.pick({
	feedbackId: true,
	content: true,
});

export type FeedbackComment = z.infer<typeof feedbackCommentSchema>;
export type FeedbackCommentSelectSchema = z.infer<typeof feedbackCommentSelectSchema>;
export type FeedbackCommentCreateSchema = z.infer<typeof feedbackCommentCreateSchema>;
