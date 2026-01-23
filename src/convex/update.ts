import { zodToConvex } from 'convex-helpers/server/zod4';
import { GenericQueryCtx } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { generateRandomSlug } from '@/lib/random';

import { DataModel, Id } from './_generated/dataModel';
import { query } from './_generated/server';
import { findMyProfile, getMyProfile } from './profile.lib';
import { verifyProjectAccess } from './project.lib';
import { updateCreateSchema, updateSchema } from './schema/update.schema';
import { mutation } from './utils/functions';
import { orgUploadsR2 } from './utils/r2';
import { updateOrgStorageUsage } from './utils/storageTracking';
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
			category: args.category ?? 'changelog',
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
			category: true,
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
			category: args.category,
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

		// Get cover image URL if one exists
		const coverImageUrl = update.coverImageId
			? await orgUploadsR2.getUrl(update.coverImageId, { expiresIn: 60 * 60 * 24 })
			: null;

		// Get comment count
		const comments = await ctx.db
			.query('updateComment')
			.withIndex('by_updateId', (q) => q.eq('updateId', update._id))
			.collect();

		return {
			update,
			coverImageUrl,
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
			commentCount: comments.length,
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

				// Get cover image URL if one exists
				const coverImageUrl = update.coverImageId
					? await orgUploadsR2.getUrl(update.coverImageId, { expiresIn: 60 * 60 * 24 })
					: null;

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
					coverImageUrl,
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

		// TODO: Delete cover image from R2 and update storage tracking
		// This will need to be implemented when we add the delete cover image feature
	}
});

// R2 upload handlers for cover images
export const { generateUploadUrl: generateCoverImageUploadUrlInternal, syncMetadata } =
	orgUploadsR2.clientApi({
		checkUpload: async (ctx: GenericQueryCtx<DataModel>, _bucket) => {
			// Verify user is authenticated
			const profile = await findMyProfile(ctx);
			if (!profile) {
				throw new ConvexError({
					code: '401',
					message: 'Forbidden — user is not authenticated',
				});
			}
		},
		onUpload: async (ctx, _bucket, key) => {
			// Parse the key to get updateId: UPDATE_COVER_PHOTO.{updateId}
			const parts = key.split('.');
			if (parts[0] !== 'UPDATE_COVER_PHOTO' || !parts[1]) {
				throw new ConvexError({
					code: '400',
					message: 'Invalid key format for cover image upload',
				});
			}

			const updateId = parts[1] as Id<'update'>;

			// Get the update to verify permissions and get org info
			const update = await ctx.db.get(updateId);
			if (!update) {
				throw new ConvexError({
					code: '404',
					message: 'Update not found',
				});
			}

			const project = await ctx.db.get(update.projectId);
			if (!project) {
				throw new ConvexError({
					code: '404',
					message: 'Project not found',
				});
			}

			// Get file metadata for size tracking
			const metadata = await orgUploadsR2.getMetadata(ctx, key);
			const newFileSize = metadata?.size ?? 0;

			// Check if there was a previous cover image (same key = replacement)
			// Since we use the same key, R2 replaces the file automatically
			// We need to track the size difference
			const oldCoverImageId = update.coverImageId;
			let sizeDelta = newFileSize;
			let fileCountDelta = 1;

			if (oldCoverImageId === key) {
				// Replacement - file count stays the same, only track size difference
				// Note: We can't get the old file size since it's already replaced
				// For accurate tracking, we'd need to store file sizes in the database
				fileCountDelta = 0;
			}

			// Update storage usage for the org
			await updateOrgStorageUsage(ctx, project.orgSlug, sizeDelta, fileCountDelta);

			// Update the update record with the cover image key
			await ctx.db.patch(updateId, {
				coverImageId: key,
				updatedTime: Date.now(),
			});
		},
	});

// Generate a signed upload URL for cover images
export const generateCoverImageUploadUrl = mutation({
	args: {
		updateId: v.id('update'),
	},
	handler: async (ctx, { updateId }) => {
		const profile = await getMyProfile(ctx);

		// Verify the update exists and user has permission
		const update = await ctx.db.get(updateId);
		if (!update) {
			throw new ConvexError({
				code: '404',
				message: 'Update not found',
			});
		}

		const project = await ctx.db.get(update.projectId);
		if (!project) {
			throw new ConvexError({
				code: '404',
				message: 'Project not found',
			});
		}

		const { permissions } = await verifyProjectAccess(ctx, { slug: project.slug });

		if (!permissions.canEdit) {
			throw new ConvexError({
				code: '403',
				message: 'You do not have permission to upload cover images for this update',
			});
		}

		// Generate key: UPDATE_COVER_PHOTO.{updateId}
		// Using updateId means replacing always overwrites the same file
		const key = `UPDATE_COVER_PHOTO.${updateId}`;

		return orgUploadsR2.generateUploadUrl(key);
	},
});

// Get the public URL for a cover image
export const getCoverImageUrl = query({
	args: {
		key: v.string(),
	},
	handler: async (_ctx, { key }) => {
		if (!key) return null;
		// URL expires in 24 hours
		return orgUploadsR2.getUrl(key, { expiresIn: 60 * 60 * 24 });
	},
});
