import { zodToConvex } from 'convex-helpers/server/zod4';
import { ConvexError } from 'convex/values';

import { getMyProfile } from './profile.lib';
import { verifyProjectAccess } from './project.lib';
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

		// Verify update exists
		const update = await ctx.db.get(args.updateId);
		if (!update) {
			throw new ConvexError({
				message: 'Update not found',
				code: '404',
			});
		}

		// If update is a draft, only editors can add emotes
		if (update.status === 'draft') {
			const project = await ctx.db.get(update.projectId);
			if (!project) {
				throw new ConvexError({
					message: 'Project not found',
					code: '404',
				});
			}

			const { permissions } = await verifyProjectAccess(ctx, { slug: project.slug });
			if (!permissions.canEdit) {
				throw new ConvexError({
					message: 'You cannot react to draft updates',
					code: '403',
				});
			}
		}

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
