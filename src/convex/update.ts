import { zodToConvex } from 'convex-helpers/server/zod4';
import { ConvexError, v } from 'convex/values';

import { generateRandomSlug } from '@/lib/random';

import { query } from './_generated/server';
import { findMyProfile, getMyProfile } from './profile.lib';
import { verifyProjectAccess } from './project.lib';
import { updateCreateSchema, updateSchema } from './schema/update.schema';
import { mutation } from './utils/functions';
import { triggers } from './utils/trigger';
import { insert, patch } from './utils/verify';

export const create = mutation({
	args: zodToConvex(updateCreateSchema),
	handler: async (ctx, args) => {
		const profile = await getMyProfile(ctx);

		// Verify user can edit this project
		const project = await ctx.db.get(args.projectId);
		if (!project) {
			throw new ConvexError({
				message: 'Project not found',
				code: '404',
			});
		}

		const { permissions } = await verifyProjectAccess(ctx, { slug: project.slug });

		if (!permissions.canEdit) {
			throw new ConvexError({
				message: 'You do not have permission to create updates for this project',
				code: '403',
			});
		}

		const slug = generateRandomSlug();

		const updateId = await insert(ctx, 'update', {
			slug,
			title: args.title,
			content: args.content,
			projectId: args.projectId,
			authorProfileId: profile._id,
			tags: args.tags,
			relatedFeedbackIds: args.relatedFeedbackIds,
			coverImageId: args.coverImageId,
		});

		return {
			updateId,
			slug,
		};
	},
});

export const update = mutation({
	args: zodToConvex(
		updateSchema.pick({
			_id: true,
			title: true,
			content: true,
			tags: true,
			relatedFeedbackIds: true,
			coverImageId: true,
		})
	),
	handler: async (ctx, args) => {
		await getMyProfile(ctx);

		const existingUpdate = await ctx.db.get(args._id);
		if (!existingUpdate) {
			throw new ConvexError({
				message: 'Update not found',
				code: '404',
			});
		}

		// Verify user can edit this project
		const project = await ctx.db.get(existingUpdate.projectId);
		if (!project) {
			throw new ConvexError({
				message: 'Project not found',
				code: '404',
			});
		}

		const { permissions } = await verifyProjectAccess(ctx, { slug: project.slug });

		if (!permissions.canEdit) {
			throw new ConvexError({
				message: 'You do not have permission to edit this update',
				code: '403',
			});
		}

		await patch(ctx, 'update', args._id, {
			title: args.title,
			content: args.content,
			tags: args.tags,
			relatedFeedbackIds: args.relatedFeedbackIds,
			coverImageId: args.coverImageId,
			updatedTime: Date.now(),
		});

		return { success: true };
	},
});

export const publish = mutation({
	args: zodToConvex(updateSchema.pick({ _id: true })),
	handler: async (ctx, args) => {
		await getMyProfile(ctx);

		const existingUpdate = await ctx.db.get(args._id);
		if (!existingUpdate) {
			throw new ConvexError({
				message: 'Update not found',
				code: '404',
			});
		}

		// Verify user can edit this project
		const project = await ctx.db.get(existingUpdate.projectId);
		if (!project) {
			throw new ConvexError({
				message: 'Project not found',
				code: '404',
			});
		}

		const { permissions } = await verifyProjectAccess(ctx, { slug: project.slug });

		if (!permissions.canEdit) {
			throw new ConvexError({
				message: 'You do not have permission to publish this update',
				code: '403',
			});
		}

		await patch(ctx, 'update', args._id, {
			status: 'published',
			publishedAt: Date.now(),
			updatedTime: Date.now(),
		});

		return { success: true };
	},
});

export const unpublish = mutation({
	args: zodToConvex(updateSchema.pick({ _id: true })),
	handler: async (ctx, args) => {
		await getMyProfile(ctx);

		const existingUpdate = await ctx.db.get(args._id);
		if (!existingUpdate) {
			throw new ConvexError({
				message: 'Update not found',
				code: '404',
			});
		}

		// Verify user can edit this project
		const project = await ctx.db.get(existingUpdate.projectId);
		if (!project) {
			throw new ConvexError({
				message: 'Project not found',
				code: '404',
			});
		}

		const { permissions } = await verifyProjectAccess(ctx, { slug: project.slug });

		if (!permissions.canEdit) {
			throw new ConvexError({
				message: 'You do not have permission to unpublish this update',
				code: '403',
			});
		}

		await patch(ctx, 'update', args._id, {
			status: 'draft',
			updatedTime: Date.now(),
		});

		return { success: true };
	},
});

export const remove = mutation({
	args: zodToConvex(updateSchema.pick({ _id: true })),
	handler: async (ctx, args) => {
		await getMyProfile(ctx);

		const existingUpdate = await ctx.db.get(args._id);
		if (!existingUpdate) {
			throw new ConvexError({
				message: 'Update not found',
				code: '404',
			});
		}

		// Verify user can edit this project
		const project = await ctx.db.get(existingUpdate.projectId);
		if (!project) {
			throw new ConvexError({
				message: 'Project not found',
				code: '404',
			});
		}

		const { permissions } = await verifyProjectAccess(ctx, { slug: project.slug });

		if (!permissions.canEdit) {
			throw new ConvexError({
				message: 'You do not have permission to delete this update',
				code: '403',
			});
		}

		await ctx.db.delete(args._id);

		return { success: true };
	},
});

export const getBySlug = query({
	args: zodToConvex(updateSchema.pick({ projectId: true, slug: true })),
	handler: async (ctx, { projectId, slug }) => {
		const update = await ctx.db
			.query('update')
			.withIndex('by_projectId_slug', (q) => q.eq('projectId', projectId).eq('slug', slug))
			.first();

		if (!update) {
			return null;
		}

		// Get project to check permissions
		const project = await ctx.db.get(projectId);
		if (!project) {
			return null;
		}

		const { permissions } = await verifyProjectAccess(ctx, { slug: project.slug });

		// If update is draft, only editors can view
		if (update.status === 'draft' && !permissions.canEdit) {
			return null;
		}

		const author = await ctx.db.get(update.authorProfileId);

		// Get related feedback items
		const relatedFeedback = update.relatedFeedbackIds
			? await Promise.all(
					update.relatedFeedbackIds.map(async (feedbackId) => {
						const feedback = await ctx.db.get(feedbackId);
						if (!feedback) return null;
						const board = await ctx.db.get(feedback.boardId);
						return {
							_id: feedback._id,
							slug: feedback.slug,
							title: feedback.title,
							status: feedback.status,
							board: board
								? {
										_id: board._id,
										name: board.name,
										slug: board.slug,
										icon: board.icon,
									}
								: null,
						};
					})
				)
			: [];

		// Get emotes for this update
		const emotes = await ctx.db
			.query('updateEmote')
			.withIndex('by_updateId', (q) => q.eq('updateId', update._id))
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
			update,
			author: author
				? {
						_id: author._id,
						username: author.username,
						name: author.name,
						imageUrl: author.imageUrl,
					}
				: null,
			relatedFeedback: relatedFeedback.filter(Boolean),
			emoteCounts,
			canEdit: permissions.canEdit,
		};
	},
});

export const listByProject = query({
	args: {
		projectId: v.id('project'),
	},
	handler: async (ctx, { projectId }) => {
		// Get project to check permissions
		const project = await ctx.db.get(projectId);
		if (!project) {
			return [];
		}

		const { permissions } = await verifyProjectAccess(ctx, { slug: project.slug });

		// If can edit, show all updates including drafts
		// Otherwise, show only published updates
		let updates;
		if (permissions.canEdit) {
			updates = await ctx.db
				.query('update')
				.withIndex('by_projectId_status_publishedAt', (q) => q.eq('projectId', projectId))
				.order('desc')
				.collect();
		} else {
			updates = await ctx.db
				.query('update')
				.withIndex('by_projectId_status_publishedAt', (q) =>
					q.eq('projectId', projectId).eq('status', 'published')
				)
				.order('desc')
				.collect();
		}

		// Get author profiles for each update
		const updatesWithDetails = await Promise.all(
			updates.map(async (update) => {
				const author = await ctx.db.get(update.authorProfileId);

				// Get emote counts
				const emotes = await ctx.db
					.query('updateEmote')
					.withIndex('by_updateId', (q) => q.eq('updateId', update._id))
					.collect();

				const emoteCounts: Record<string, { count: number; authorProfileIds: string[] }> = {};
				for (const emote of emotes) {
					if (!emoteCounts[emote.content]) {
						emoteCounts[emote.content] = { count: 0, authorProfileIds: [] };
					}
					emoteCounts[emote.content].count++;
					emoteCounts[emote.content].authorProfileIds.push(emote.authorProfileId);
				}

				// Get comment count
				const comments = await ctx.db
					.query('updateComment')
					.withIndex('by_updateId', (q) => q.eq('updateId', update._id))
					.collect();

				return {
					...update,
					author: author
						? {
								_id: author._id,
								username: author.username,
								name: author.name,
								imageUrl: author.imageUrl,
							}
						: null,
					emoteCounts,
					commentCount: comments.length,
				};
			})
		);

		return {
			updates: updatesWithDetails,
			canEdit: permissions.canEdit,
		};
	},
});

// Trigger to cascade delete comments and emotes when an update is deleted
triggers.register('update', async (ctx, change) => {
	if (change.operation === 'delete') {
		// Delete associated comments
		const comments = await ctx.db
			.query('updateComment')
			.withIndex('by_updateId', (q) => q.eq('updateId', change.oldDoc._id))
			.collect();

		for (const comment of comments) {
			await ctx.db.delete(comment._id);
		}

		// Delete associated emotes on the update itself
		const emotes = await ctx.db
			.query('updateEmote')
			.withIndex('by_updateId', (q) => q.eq('updateId', change.oldDoc._id))
			.collect();

		for (const emote of emotes) {
			await ctx.db.delete(emote._id);
		}

		// Delete associated comment emotes
		const commentEmotes = await ctx.db
			.query('updateCommentEmote')
			.withIndex('by_updateId', (q) => q.eq('updateId', change.oldDoc._id))
			.collect();

		for (const commentEmote of commentEmotes) {
			await ctx.db.delete(commentEmote._id);
		}
	}
});
