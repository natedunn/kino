import { zid } from 'convex-helpers/server/zod';
import { z } from 'zod';

import { SHARED_SCHEMA } from './_shared';

export const feedback = z.object({
	...SHARED_SCHEMA('feedback'),
	content: z.string().min(1).max(500),
	authorProfileId: zid('profile'),
	projectId: zid('project'),
	upvotes: z.number().default(0),
	board: zid('feedbackBoard'),
});

export const feedbackSelectSchema = feedback;
export const feedbackCreateSchema = feedback.pick({
	content: true,
	board: true,
});

export type Feedback = z.infer<typeof feedback>;
export type FeedbackSelectSchema = z.infer<typeof feedbackSelectSchema>;
export type FeedbackCreateSchema = z.infer<typeof feedbackCreateSchema>;
