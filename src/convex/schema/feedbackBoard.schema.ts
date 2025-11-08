import { z } from 'zod';

import { zid } from '@/_modules/zod4';

import { SHARED_SCHEMA } from './_shared';

export const feedbackBoardSchema = z.object({
	...SHARED_SCHEMA('feedbackBoard'),
	name: z.string().min(1).max(50),
	projectId: zid('project'),
	description: z.string().optional(),
});

export const feedbackBoardSelectSchema = feedbackBoardSchema;
export const feedbackBoardCreateSchema = feedbackBoardSchema.pick({
	name: true,
	projectId: true,
	description: true,
});
export const feedbackBoardUpdateSchema = feedbackBoardSchema.partial().merge(
	feedbackBoardSchema.pick({
		_id: true,
	})
);

export type FeedbackBoard = z.infer<typeof feedbackBoardSchema>;
export type FeedbackBoardSelectSchema = z.infer<typeof feedbackBoardSelectSchema>;
export type FeedbackBoardCreateSchema = z.infer<typeof feedbackBoardCreateSchema>;
export type FeedbackBoardUpdateSchema = z.infer<typeof feedbackBoardUpdateSchema>;
