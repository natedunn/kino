import { z } from 'zod';

import { optionalAuthQuery, privateMutation } from '../lib/crpc';
import { asId, getDoc, getProjectViewAccess, toPublicDoc } from '../lib/kino';
import { resolveProfileImageUrl } from '../lib/storage';
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
			.collect();

		return await Promise.all(
			events.map(async (event: any) => {
				const actor = await getDoc<'profile'>(ctx, event.actorProfileId);
				const targetProfile = event.metadata?.targetProfileId
					? await getDoc<'profile'>(ctx, asId<'profile'>(event.metadata.targetProfileId))
					: null;

				return {
					...toPublicDoc(event),
					actor: actor
						? {
								id: actor._id,
								imageUrl: await resolveProfileImageUrl(actor),
								name: actor.name,
								username: actor.username,
							}
						: null,
					targetProfile: targetProfile
						? {
								id: targetProfile._id,
								imageUrl: await resolveProfileImageUrl(targetProfile),
								name: targetProfile.name,
								username: targetProfile.username,
							}
						: null,
				};
			})
		);
	});
