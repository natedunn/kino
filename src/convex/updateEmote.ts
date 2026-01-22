import { zodToConvex } from 'convex-helpers/server/zod4';

import { getMyProfile } from './profile.lib';
import { updateEmoteSchema } from './schema/updateEmote.schema';
import { mutation } from './utils/functions';
import { triggers } from './utils/trigger';
import { insert } from './utils/verify';

// Toggle an emote on an update - adds if not present, removes if already added by this user
export const toggle = mutation({
	args: zodToConvex(
		updateEmoteSchema.pick({
			updateId: true,
			content: true,
		})
	),
	handler: async (ctx, args) => {
		const profile = await getMyProfile(ctx);

		// Check if user already has this emote on this update
		const existingEmote = await ctx.db
			.query('updateEmote')
			.withIndex('by_updateId_authorProfileId', (q) =>
				q.eq('updateId', args.updateId).eq('authorProfileId', profile._id)
			)
			.filter((q) => q.eq(q.field('content'), args.content))
			.first();

		if (existingEmote) {
			// Remove the emote
			await ctx.db.delete(existingEmote._id);
			return { action: 'removed' as const };
		} else {
			// Add the emote
			await insert(ctx, 'updateEmote', {
				updateId: args.updateId,
				authorProfileId: profile._id,
				content: args.content,
			});
			return { action: 'added' as const };
		}
	},
});

triggers.register('updateEmote', async () => {});
