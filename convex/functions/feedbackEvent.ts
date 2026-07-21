import { z } from 'zod';

import { optionalAuthQuery, privateMutation } from '../lib/crpc';
import { asId, getDoc, getProjectViewAccess } from '../lib/kino';
import { createProfileImageUrlCache } from '../lib/storage';
import { idSchema } from '../lib/validation';
import {
	createOrUpdateFeedbackEvent,
	enrichFeedbackEvent,
	feedbackEventMetadataSchema,
	feedbackEventTypeSchema,
	MAX_TIMELINE_EVENTS,
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

export const listByFeedback = optionalAuthQuery
	.input(
		z.object({
			feedbackId: idSchema,
		})
	)
	.query(async ({ ctx, input }) => {
		const feedback = await getDoc(ctx, asId<'feedback'>(input.feedbackId));
		if (!feedback) return [];

		const access = await getProjectViewAccess(ctx, {
			id: feedback.projectId,
			userId: ctx.userId,
		});
		if (!access.permissions.canView) return [];

		const events = await ctx.db
			.query('feedbackEvent')
			.withIndex('by_feedbackId', (q: any) => q.eq('feedbackId', input.feedbackId))
			.order('asc')
			.take(MAX_TIMELINE_EVENTS);

		const imageUrlCache = createProfileImageUrlCache();
		return await Promise.all(
			events.map((event: any) => enrichFeedbackEvent(ctx, event, imageUrlCache))
		);
	});
