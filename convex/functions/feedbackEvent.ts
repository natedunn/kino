import { z } from 'zod';

import { privateMutation } from '../lib/crpc';
import { idSchema } from '../lib/validation';
import {
	createOrUpdateFeedbackEvent,
	feedbackEventMetadataSchema,
	feedbackEventTypeSchema,
} from './feedbackEvent.lib';

export const create = privateMutation
	.input(
		z.object({
			actorProfileId: idSchema,
			eventType: feedbackEventTypeSchema,
			feedbackId: idSchema,
			metadata: feedbackEventMetadataSchema,
		})
	)
	.mutation(async ({ ctx, input }) => await createOrUpdateFeedbackEvent(ctx, input));
