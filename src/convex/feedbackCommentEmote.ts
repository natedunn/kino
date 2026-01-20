import { zodToConvex } from 'convex-helpers/server/zod4';

import { getMyProfile } from './profile.lib';
import { feedbackCommentEmoteSchema } from './schema/feedbackCommentEmote.schema';
import { mutation } from './utils/functions';
import { triggers } from './utils/trigger';
import { insert } from './utils/verify';

// Toggle an emote on a comment - adds if not present, removes if already added by this user
export const toggle = mutation({
	args: zodToConvex(
		feedbackCommentEmoteSchema.pick({
			feedbackId: true,
			feedbackCommentId: true,
			content: true,
		})
	),
	handler: async (ctx, args) => {
		const profile = await getMyProfile(ctx);

		// Check if user already has this emote on this comment
		const existingEmote = await ctx.db
			.query('feedbackCommentEmote')
			.withIndex('by_feedbackCommentId', (q) => q.eq('feedbackCommentId', args.feedbackCommentId))
			.filter((q) =>
				q.and(
					q.eq(q.field('authorProfileId'), profile._id),
					q.eq(q.field('content'), args.content)
				)
			)
			.first();

		if (existingEmote) {
			// Remove the emote
			await ctx.db.delete(existingEmote._id);
			return { action: 'removed' as const };
		} else {
			// Add the emote
			await insert(ctx, 'feedbackCommentEmote', {
				feedbackId: args.feedbackId,
				feedbackCommentId: args.feedbackCommentId,
				authorProfileId: profile._id,
				content: args.content,
			});
			return { action: 'added' as const };
		}
	},
});

triggers.register('feedbackCommentEmote', async () => {});
