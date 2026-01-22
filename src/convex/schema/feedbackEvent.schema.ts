import { zid } from 'convex-helpers/server/zod4';
import * as z from 'zod';

import { SHARED_SCHEMA } from './_shared';

export const feedbackEventType = z.enum([
	'status_changed',
	'board_changed',
	'assigned',
	'unassigned',
	'title_changed',
	'answer_marked',
	'answer_unmarked',
]);

export const feedbackEventMetadata = z.object({
	oldValue: z.string().optional(),
	newValue: z.string().optional(),
	targetProfileId: z.string().optional(),
});

export const feedbackEventSchema = z.object({
	...SHARED_SCHEMA('feedbackEvent'),
	feedbackId: zid('feedback'),
	actorProfileId: zid('profile'),
	eventType: feedbackEventType,
	metadata: feedbackEventMetadata.optional(),
});

export type FeedbackEvent = z.infer<typeof feedbackEventSchema>;
export type FeedbackEventType = z.infer<typeof feedbackEventType>;
export type FeedbackEventMetadata = z.infer<typeof feedbackEventMetadata>;
