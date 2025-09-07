import { zid } from 'convex-helpers/server/zod';
import { z } from 'zod';

import { SHARED_SCHEMA } from './_shared';

export const feedbackBoard = z.object({
	...SHARED_SCHEMA('feedbackBoard'),
	name: z.string().min(1).max(50),
	projectId: zid('project'),
});

export const feedbackBoardSelectSchema = feedbackBoard;
export const feedbackBoardCreateSchema = feedbackBoard.pick({
	name: true,
	projectId: true,
});
export const feedbackBoardUpdateSchema = feedbackBoard.partial();

export type FeedbackBoard = z.infer<typeof feedbackBoard>;
export type FeedbackBoardSelectSchema = z.infer<typeof feedbackBoardSelectSchema>;
export type FeedbackBoardCreateSchema = z.infer<typeof feedbackBoardCreateSchema>;
export type FeedbackBoardUpdateSchema = z.infer<typeof feedbackBoardUpdateSchema>;
