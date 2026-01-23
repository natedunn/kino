import { zodToConvex } from 'convex-helpers/server/zod4';
import { ConvexError } from 'convex/values';

import { query } from './_generated/server';
import { getMyProfile } from './profile.lib';
import { verifyProjectAccess } from './project.lib';
import { updateCommentCreateSchema, updateCommentSchema } from './schema/updateComment.schema';
import { mutation } from './utils/functions';
import { triggers } from './utils/trigger';
import { insert } from './utils/verify';

const TEAM_ROLES = ['admin', 'org:admin', 'org:editor'] as const;

export const create = mutation({
	args: zodToConvex(updateCommentCreateSchema),
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

		// Published updates allow any authenticated user to comment
		// Draft updates only allow editors to comment
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
					message: 'You cannot comment on draft updates',
					code: '403',
				});
			}
		}

		const commentId = await insert(ctx, 'updateComment', {
			updateId: args.updateId,
			authorProfileId: profile._id,
			content: args.content,
		});

		return { commentId };
	},
});

export const update = mutation({
	args: zodToConvex(updateCommentSchema.pick({ _id: true, content: true })),
	handler: async (ctx, args) => {
		const profile = await getMyProfile(ctx);

		const comment = await ctx.db.get(args._id);

		if (!comment) {
			throw new ConvexError({
				message: 'Comment not found',
				code: '404',
			});
		}

		// Only the author can edit their own comments
		if (comment.authorProfileId !== profile._id) {
			throw new ConvexError({
				message: 'You can only edit your own comments',
				code: '403',
			});
		}

		await ctx.db.patch(args._id, {
			content: args.content,
			updatedTime: Date.now(),
		});

		return { updated: true };
	},
});

export const remove = mutation({
	args: zodToConvex(updateCommentSchema.pick({ _id: true })),
	handler: async (ctx, args) => {
		const profile = await getMyProfile(ctx);

		const comment = await ctx.db.get(args._id);

		if (!comment) {
			throw new ConvexError({
				message: 'Comment not found',
				code: '404',
			});
		}

		// Only the author can delete their own comments
		if (comment.authorProfileId !== profile._id) {
			throw new ConvexError({
				message: 'You can only delete your own comments',
				code: '403',
			});
		}

		await ctx.db.delete(args._id);

		return { deleted: true };
	},
});

export const listByUpdate = query({
	args: zodToConvex(updateCommentSchema.pick({ updateId: true })),
	handler: async (ctx, { updateId }) => {
		// Get the update to check permissions
		const update = await ctx.db.get(updateId);
		if (!update) {
			return [];
		}

		// If update is a draft, verify user can edit
		if (update.status === 'draft') {
			const project = await ctx.db.get(update.projectId);
			if (!project) {
				return [];
			}

			const { permissions } = await verifyProjectAccess(ctx, { slug: project.slug });
			if (!permissions.canEdit) {
				return [];
			}
		}

		const comments = await ctx.db
			.query('updateComment')
			.withIndex('by_updateId', (q) => q.eq('updateId', updateId))
			.order('asc')
			.collect();

		const projectId = update.projectId;

		// Get author profiles and emotes for each comment
		const commentsWithDetails = await Promise.all(
			comments.map(async (comment) => {
				const author = await ctx.db.get(comment.authorProfileId);

				// Check if author is a team member
				let isTeamMember = false;
				if (projectId && author) {
					const projectMember = await ctx.db
						.query('projectMember')
						.withIndex('by_profileId_projectId', (q) =>
							q.eq('profileId', author._id).eq('projectId', projectId)
						)
						.first();
					isTeamMember =
						projectMember !== null &&
						TEAM_ROLES.includes(projectMember.role as (typeof TEAM_ROLES)[number]);
				}

				// Get emotes for this comment
				const emotes = await ctx.db
					.query('updateCommentEmote')
					.withIndex('by_updateCommentId', (q) => q.eq('updateCommentId', comment._id))
					.collect();

				// Group emotes by content type and count them
				const emoteCounts: Record<string, { count: number; authorProfileIds: string[] }> = {};
				for (const emote of emotes) {
					if (!emoteCounts[emote.content]) {
						emoteCounts[emote.content] = { count: 0, authorProfileIds: [] };
					}
					emoteCounts[emote.content].count++;
					emoteCounts[emote.content].authorProfileIds.push(emote.authorProfileId);
				}

				return {
					...comment,
					author: author
						? {
								_id: author._id,
								username: author.username,
								name: author.name,
								imageUrl: author.imageUrl,
							}
						: null,
					isTeamMember,
					emoteCounts,
				};
			})
		);

		return commentsWithDetails;
	},
});

// Cascade delete emotes when a comment is deleted
triggers.register('updateComment', async (ctx, change) => {
	if (change.operation === 'delete') {
		const emotes = await ctx.db
			.query('updateCommentEmote')
			.withIndex('by_updateCommentId', (q) => q.eq('updateCommentId', change.oldDoc._id))
			.collect();

		for (const emote of emotes) {
			await ctx.db.delete(emote._id);
		}
	}
});
