import { zid } from 'convex-helpers/server/zod4';
import * as z from 'zod';

import { SHARED_SCHEMA } from './_shared';
import { feedbackCommentSchema } from './feedbackComment.schema';

export const feedbackSchema = z.object({
	...SHARED_SCHEMA('feedback'),
	title: z.string().min(1).max(100),
	authorProfileId: zid('profile'),
	projectId: zid('project'),
	upvotes: z.number().default(0),
	boardId: zid('feedbackBoard'),
	firstCommentId: z.optional(zid('feedbackComment')),
	status: z.enum(['open', 'in-progress', 'closed', 'completed']).optional(),
	tags: z.array(z.string()).optional(),
	searchContent: z.string().optional(),
	slug: z.string().optional(),
});

// projectId
// boardId
// status
// searchContent
// tags
// projectId + boardId
// projectId + boardId + status
// projectId + boardId + status + searchContent
// projectId + boardId + status + searchContent + tags

export const feedbackSelectSchema = feedbackSchema;
export const feedbackCreateSchema = feedbackSchema
	.pick({
		title: true,
		boardId: true,
		projectId: true,
	})
	.extend(
		z.object({
			firstComment: feedbackCommentSchema.shape.content,
		}).shape
	);

export type Feedback = z.infer<typeof feedbackSchema>;
export type FeedbackSelectSchema = z.infer<typeof feedbackSelectSchema>;
export type FeedbackCreateSchema = z.infer<typeof feedbackCreateSchema>;
