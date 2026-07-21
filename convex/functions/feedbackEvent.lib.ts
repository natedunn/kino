import type { ProfileImageUrlCache } from '../lib/storage';

import { eq } from 'kitcn/orm';
import { z } from 'zod';

import { asId, getDoc, toPublicDoc } from '../lib/kino';
import { resolveProfileImageUrl } from '../lib/storage';
import { idSchema } from '../lib/validation';
import { feedbackEventTable } from './schema';

// Enrich a raw feedback event with its actor / target profiles (name + signed
// avatar URL). Shared by `feedbackEvent.listByFeedback` and the merged feedback
// timeline so both produce identical event shapes. Pass a `ProfileImageUrlCache`
// to dedupe avatar presigns when enriching many events in one query.
export async function enrichFeedbackEvent(
	ctx: any,
	event: any,
	imageUrlCache?: ProfileImageUrlCache
) {
	const actor = await getDoc<'profile'>(ctx, event.actorProfileId);
	const targetProfile = event.metadata?.targetProfileId
		? await getDoc<'profile'>(ctx, asId<'profile'>(event.metadata.targetProfileId))
		: null;

	return {
		...toPublicDoc(event),
		actor: actor
			? {
					id: actor._id,
					imageUrl: await resolveProfileImageUrl(actor, imageUrlCache),
					name: actor.name,
					username: actor.username,
				}
			: null,
		targetProfile: targetProfile
			? {
					id: targetProfile._id,
					imageUrl: await resolveProfileImageUrl(targetProfile, imageUrlCache),
					name: targetProfile.name,
					username: targetProfile.username,
				}
			: null,
	};
}

export const feedbackEventTypeSchema = z.enum([
	'status_changed',
	'priority_changed',
	'board_changed',
	'assigned',
	'unassigned',
	'title_changed',
	'answer_marked',
	'answer_unmarked',
]);

export const feedbackEventMetadataSchema = z
	.object({
		newValue: z.string().trim().max(256).optional(),
		oldValue: z.string().trim().max(256).optional(),
		targetProfileId: idSchema.optional(),
	})
	.optional();

export const COALESCE_WINDOW_MS = 60 * 1000;

export async function createOrUpdateFeedbackEvent(
	ctx: { db: any; orm: any },
	input: {
		actorProfileId: string;
		eventType: z.infer<typeof feedbackEventTypeSchema>;
		feedbackId: string;
		metadata?: z.infer<typeof feedbackEventMetadataSchema>;
	}
) {
	const now = Date.now();
	const windowStart = now - COALESCE_WINDOW_MS;

	// Find the newest same-type/same-actor event within the coalescing window.
	// Events are creation-time ordered, so iterate newest-first and stop as soon as
	// we cross `windowStart` — reading only the in-window tail instead of collecting
	// the feedback's entire event history on every write.
	let recentEvent: any = null;
	for await (const event of ctx.db
		.query('feedbackEvent')
		.withIndex('by_feedbackId', (q: any) => q.eq('feedbackId', input.feedbackId))
		.order('desc')) {
		if (event._creationTime < windowStart) break;
		if (event.eventType === input.eventType && event.actorProfileId === input.actorProfileId) {
			recentEvent = event;
			break;
		}
	}

	if (recentEvent) {
		await ctx.orm
			.update(feedbackEventTable)
			.set({
				metadata: {
					...recentEvent.metadata,
					newValue: input.metadata?.newValue ?? recentEvent.metadata?.newValue,
					oldValue: recentEvent.metadata?.oldValue ?? input.metadata?.oldValue,
					targetProfileId: input.metadata?.targetProfileId ?? recentEvent.metadata?.targetProfileId,
				},
				updatedTime: now,
			})
			.where(eq(feedbackEventTable.id, recentEvent._id));
		return recentEvent._id;
	}

	const [event] = await ctx.orm
		.insert(feedbackEventTable)
		.values({
			actorProfileId: input.actorProfileId as any,
			eventType: input.eventType,
			feedbackId: input.feedbackId as any,
			metadata: input.metadata,
			updatedTime: now,
		})
		.returning();
	return event.id;
}

export async function recordFeedbackEvent(
	ctx: { db: any; orm: any },
	input: {
		actorProfileId: string;
		eventType: z.infer<typeof feedbackEventTypeSchema>;
		feedbackId: string;
		metadata?: z.infer<typeof feedbackEventMetadataSchema>;
	}
) {
	return await createOrUpdateFeedbackEvent(ctx, input);
}
