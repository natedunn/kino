import { zodToConvex } from 'convex-helpers/server/zod4';

import { getMyProfile } from './profile.lib';
import { updateCommentEmoteSchema } from './schema/updateCommentEmote.schema';
import { mutation } from './utils/functions';
import { triggers } from './utils/trigger';
import { insert } from './utils/verify';

// Toggle an emote on a comment - adds if not present, removes if already added by this user
export const toggle = mutation({
	args: zodToConvex(
		updateCommentEmoteSchema.pick({
			updateId: true,
			updateCommentId: true,
			content: true,
		})
	),
	handler: async (ctx, args) => {
		const profile = await getMyProfile(ctx);

		// Check if user already has this emote on this comment
		const existingEmote = await ctx.db
			.query('updateCommentEmote')
			.withIndex('by_updateCommentId', (q) => q.eq('updateCommentId', args.updateCommentId))
			.filter((q) =>
				q.and(q.eq(q.field('authorProfileId'), profile._id), q.eq(q.field('content'), args.content))
			)
			.first();

		if (existingEmote) {
			// Remove the emote
			await ctx.db.delete(existingEmote._id);
			return { action: 'removed' as const };
		} else {
			// Add the emote
			await insert(ctx, 'updateCommentEmote', {
				updateId: args.updateId,
				updateCommentId: args.updateCommentId,
				authorProfileId: profile._id,
				content: args.content,
			});
			return { action: 'added' as const };
		}
	},
});

triggers.register('updateCommentEmote', async () => {});
