import { zid, zodToConvex } from 'convex-helpers/server/zod4';
import { v } from 'convex/values';
import * as z from 'zod';

import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { MutationCtx, query } from './_generated/server';
import {
	feedbackEventMetadata,
	feedbackEventSchema,
	feedbackEventType,
} from './schema/feedbackEvent.schema';
import { internalMutation } from './utils/functions';
import { insert } from './utils/verify';

const createEventSchema = z.object({
	feedbackId: zid('feedback'),
	actorProfileId: zid('profile'),
	eventType: feedbackEventType,
	metadata: feedbackEventMetadata.optional(),
});

const COALESCE_WINDOW_MS = 60 * 1000; // 60 seconds

export const create = internalMutation({
	args: zodToConvex(createEventSchema),
	returns: v.id('feedbackEvent'),
	handler: async (ctx, args) => {
		const now = Date.now();
		const windowStart = now - COALESCE_WINDOW_MS;

		// Check for a recent event of the same type for the same feedback from the same actor
		const recentEvents = await ctx.db
			.query('feedbackEvent')
			.withIndex('by_feedbackId', (q) => q.eq('feedbackId', args.feedbackId))
			.order('desc')
			.collect();

		const recentEvent = recentEvents.find(
			(event) =>
				event.eventType === args.eventType &&
				event.actorProfileId === args.actorProfileId &&
				event._creationTime >= windowStart
		);

		if (recentEvent) {
			// Update the existing event instead of creating a new one
			// Preserve the original oldValue but update the newValue/targetProfileId
			const mergedMetadata = {
				...recentEvent.metadata,
				newValue: args.metadata?.newValue ?? recentEvent.metadata?.newValue,
				targetProfileId: args.metadata?.targetProfileId ?? recentEvent.metadata?.targetProfileId,
			};

			await ctx.db.patch(recentEvent._id, {
				metadata: mergedMetadata,
				updatedTime: now,
			});

			return recentEvent._id;
		}

		// No recent event found, create a new one
		const eventId = await insert(ctx, 'feedbackEvent', {
			feedbackId: args.feedbackId,
			actorProfileId: args.actorProfileId,
			eventType: args.eventType,
			metadata: args.metadata,
		});

		return eventId;
	},
});

// Helper function to create events from other mutations
export async function createEvent(
	ctx: MutationCtx,
	args: {
		feedbackId: Id<'feedback'>;
		actorProfileId: Id<'profile'>;
		eventType: z.infer<typeof feedbackEventType>;
		metadata?: z.infer<typeof feedbackEventMetadata>;
	}
) {
	return await ctx.runMutation(internal.feedbackEvent.create, args);
}

export const listByFeedback = query({
	args: zodToConvex(feedbackEventSchema.pick({ feedbackId: true })),
	handler: async (ctx, { feedbackId }) => {
		const events = await ctx.db
			.query('feedbackEvent')
			.withIndex('by_feedbackId', (q) => q.eq('feedbackId', feedbackId))
			.order('asc')
			.collect();

		// Get actor details for each event
		const eventsWithDetails = await Promise.all(
			events.map(async (event) => {
				const actor = await ctx.db.get(event.actorProfileId);

				// Get target profile if applicable
				let targetProfile = null;
				if (event.metadata?.targetProfileId) {
					targetProfile = await ctx.db.get(
						event.metadata.targetProfileId as Id<'profile'>
					);
				}

				return {
					...event,
					actor: actor
						? {
								_id: actor._id,
								username: actor.username,
								name: actor.name,
								imageUrl: actor.imageUrl,
							}
						: null,
					targetProfile: targetProfile
						? {
								_id: targetProfile._id,
								username: targetProfile.username,
								name: targetProfile.name,
								imageUrl: targetProfile.imageUrl,
							}
						: null,
				};
			})
		);

		return eventsWithDetails;
	},
});
