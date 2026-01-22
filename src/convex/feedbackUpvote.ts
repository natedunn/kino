import { TableAggregate } from '@convex-dev/aggregate';
import { zodToConvex } from 'convex-helpers/server/zod4';
import { ConvexError, v } from 'convex/values';
import * as z from 'zod';

import { components } from './_generated/api';
import { DataModel, Id } from './_generated/dataModel';
import { query } from './_generated/server';
import { findMyProfile } from './profile.lib';
import { feedbackUpvoteSchema } from './schema/feedbackUpvote.schema';
import { mutation } from './utils/functions';
import { triggers } from './utils/trigger';
import { insert } from './utils/verify';

// Set up TableAggregate with namespace by feedbackId for efficient counting
const upvoteAggregate = new TableAggregate<{
	Namespace: Id<'feedback'>;
	Key: null;
	DataModel: DataModel;
	TableName: 'feedbackUpvote';
}>(components.feedbackUpvotes, {
	namespace: (doc) => doc.feedbackId,
	sortKey: () => null,
});

// Register trigger for automatic sync
triggers.register('feedbackUpvote', upvoteAggregate.trigger());

// Toggle upvote - adds upvote if not exists, removes if exists
const toggleSchema = z.object({
	feedbackId: feedbackUpvoteSchema.shape.feedbackId,
});

export const toggle = mutation({
	args: zodToConvex(toggleSchema),
	handler: async (ctx, { feedbackId }) => {
		const profile = await findMyProfile(ctx);

		if (!profile) {
			throw new ConvexError({
				message: 'You must be logged in to upvote feedback',
				code: '401',
			});
		}

		// Check if feedback exists
		const feedback = await ctx.db.get(feedbackId);
		if (!feedback) {
			throw new ConvexError({
				message: 'Feedback not found',
				code: '404',
			});
		}

		// Check if user has already upvoted
		const existingUpvote = await ctx.db
			.query('feedbackUpvote')
			.withIndex('by_feedbackId_authorProfileId', (q) =>
				q.eq('feedbackId', feedbackId).eq('authorProfileId', profile._id)
			)
			.unique();

		if (existingUpvote) {
			// Remove the upvote
			await ctx.db.delete(existingUpvote._id);

			// Update the feedback upvote count
			const newCount = Math.max(0, (feedback.upvotes ?? 0) - 1);
			await ctx.db.patch(feedbackId, { upvotes: newCount });

			return {
				upvoted: false,
				count: newCount,
			};
		} else {
			// Add the upvote
			await insert(ctx, 'feedbackUpvote', {
				feedbackId,
				authorProfileId: profile._id,
			});

			// Update the feedback upvote count
			const newCount = (feedback.upvotes ?? 0) + 1;
			await ctx.db.patch(feedbackId, { upvotes: newCount });

			return {
				upvoted: true,
				count: newCount,
			};
		}
	},
});

// Get count for a feedback item using aggregate
export const getCount = query({
	args: {
		feedbackId: v.id('feedback'),
	},
	returns: v.number(),
	handler: async (ctx, { feedbackId }) => {
		return await upvoteAggregate.count(ctx, { namespace: feedbackId });
	},
});

// Check if current user has upvoted
export const hasUpvoted = query({
	args: {
		feedbackId: v.id('feedback'),
	},
	returns: v.boolean(),
	handler: async (ctx, { feedbackId }) => {
		const profile = await findMyProfile(ctx);

		if (!profile) {
			return false;
		}

		const existingUpvote = await ctx.db
			.query('feedbackUpvote')
			.withIndex('by_feedbackId_authorProfileId', (q) =>
				q.eq('feedbackId', feedbackId).eq('authorProfileId', profile._id)
			)
			.unique();

		return !!existingUpvote;
	},
});

// Get both count and hasUpvoted for efficiency
export const getUpvoteData = query({
	args: {
		feedbackId: v.id('feedback'),
	},
	returns: v.object({
		count: v.number(),
		hasUpvoted: v.boolean(),
	}),
	handler: async (ctx, { feedbackId }) => {
		const profile = await findMyProfile(ctx);

		// Get count from the feedback document (denormalized)
		const feedback = await ctx.db.get(feedbackId);
		const count = feedback?.upvotes ?? 0;

		if (!profile) {
			return {
				count,
				hasUpvoted: false,
			};
		}

		const existingUpvote = await ctx.db
			.query('feedbackUpvote')
			.withIndex('by_feedbackId_authorProfileId', (q) =>
				q.eq('feedbackId', feedbackId).eq('authorProfileId', profile._id)
			)
			.unique();

		return {
			count,
			hasUpvoted: !!existingUpvote,
		};
	},
});
