
import { createFunctionHandle } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { eq } from 'kitcn/orm';
import { CRPCError } from 'kitcn/server';
import { z } from 'zod';

import { authMutation, authQuery, optionalAuthQuery } from '../lib/crpc';
import {
	asId,
	generateRandomSlug,
	getCurrentProfile,
	getCurrentProfileOrThrow,
	getDoc,
	getDocOrThrow,
	getProjectViewAccess,
	toPublicDoc,
	verifyProjectAccess,
} from '../lib/kino';
import { orgUploadsR2 } from '../lib/r2';
import {
	deleteCoverImageAttachment,
	getCoverImageR2Metadata,
	resolveCoverImageUrl,
	resolveProfileImageUrl,
	updateOrgStorageUsage,
	validateCoverImageMetadata,
} from '../lib/storage';
import {
	generatedSlugSchema,
	idArraySchema,
	idListSchema,
	idSchema,
	storageKeySchema,
	tagListSchema,
	updateContentSchema,
	updateTitleSchema,
} from '../lib/validation';
import { internal } from './_generated/api';
import { internalMutation } from './generated/server';
import { UPDATE_CATEGORIES, updateTable } from './schema';
import {
	MIDDLE_COMMENT_PAGE_SIZE,
	createCommentEnrichCache,
	dedupeComments,
	dedupeDocsById,
	getUpdateCommentWindow,
	getUpdateListPreview,
	toProfileSummary,
	toPublicUpdateComment,
	updateCategorySchema,
} from './update.lib';
import type { Doc, Id } from './_generated/dataModel';

export const create = authMutation
	.input(
		z.object({
			category: updateCategorySchema.optional(),
			content: updateContentSchema,
			coverImageId: storageKeySchema.optional(),
			projectId: idSchema,
			relatedFeedbackIds: idArraySchema.optional(),
			tags: tagListSchema.optional(),
			title: updateTitleSchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const profile = await getCurrentProfileOrThrow(ctx, ctx.userId);
		const project = await getDocOrThrow(ctx, asId<'project'>(input.projectId), 'Project not found');
		const access = await verifyProjectAccess(ctx, {
			slug: project.slug,
			userId: ctx.userId,
		});

		if (!access.permissions.canEdit) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You do not have permission to create updates for this project',
			});
		}

		const [updateRow] = await ctx.orm
			.insert(updateTable)
			.values({
				authorProfileId: profile._id,
				category: input.category ?? 'changelog',
				content: input.content,
				coverImageId: input.coverImageId ?? null,
				projectId: project._id as any,
				relatedFeedbackIds: input.relatedFeedbackIds?.map((id) => asId<'feedback'>(id)) ?? [],
				slug: generateRandomSlug(),
				status: 'draft',
				tags: input.tags ?? [],
				title: input.title,
				updatedTime: Date.now(),
			})
			.returning();

		return { slug: updateRow.slug, updateId: updateRow.id };
	});

export const update = authMutation
	.input(
		z.object({
			id: idSchema,
			category: updateCategorySchema.optional(),
			content: updateContentSchema.optional(),
			coverImageId: storageKeySchema.nullable().optional(),
			relatedFeedbackIds: idArraySchema.optional(),
			tags: tagListSchema.optional(),
			title: updateTitleSchema.optional(),
		})
	)
	.mutation(async ({ ctx, input }) => {
		const existingUpdate = await getDocOrThrow(ctx, asId<'update'>(input.id), 'Update not found');
		const project = await getDocOrThrow(ctx, existingUpdate.projectId, 'Project not found');
		const access = await verifyProjectAccess(ctx, {
			slug: project.slug,
			userId: ctx.userId,
		});

		if (!access.permissions.canEdit) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You do not have permission to edit this update',
			});
		}

		const nextCoverImageId =
			input.coverImageId === undefined ? (existingUpdate.coverImageId ?? null) : input.coverImageId;

		const patch = Object.fromEntries(
			Object.entries({
				category: input.category,
				content: input.content,
				coverImageId: input.coverImageId === undefined ? undefined : nextCoverImageId,
				relatedFeedbackIds: input.relatedFeedbackIds?.map((id) => asId<'feedback'>(id)),
				tags: input.tags,
				title: input.title,
				updatedTime: Date.now(),
			}).filter(([, value]) => value !== undefined)
		);

		await ctx.orm
			.update(updateTable)
			.set(patch)
			.where(eq(updateTable.id, existingUpdate._id as any));
		return { success: true };
	});

export const publish = authMutation
	.input(
		z.object({
			id: idSchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const existingUpdate = await getDocOrThrow(ctx, asId<'update'>(input.id), 'Update not found');
		const project = await getDocOrThrow(ctx, existingUpdate.projectId, 'Project not found');
		const access = await verifyProjectAccess(ctx, {
			slug: project.slug,
			userId: ctx.userId,
		});

		if (!access.permissions.canEdit) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You do not have permission to publish this update',
			});
		}

		await ctx.orm
			.update(updateTable)
			.set({
				publishedAt: Date.now(),
				status: 'published',
				updatedTime: Date.now(),
			})
			.where(eq(updateTable.id, existingUpdate._id as any));
		return { success: true };
	});

export const unpublish = authMutation
	.input(
		z.object({
			id: idSchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const existingUpdate = await getDocOrThrow(ctx, asId<'update'>(input.id), 'Update not found');
		const project = await getDocOrThrow(ctx, existingUpdate.projectId, 'Project not found');
		const access = await verifyProjectAccess(ctx, {
			slug: project.slug,
			userId: ctx.userId,
		});

		if (!access.permissions.canEdit) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You do not have permission to unpublish this update',
			});
		}

		await ctx.orm
			.update(updateTable)
			.set({
				status: 'draft',
				updatedTime: Date.now(),
			})
			.where(eq(updateTable.id, existingUpdate._id as any));
		return { success: true };
	});

export const remove = authMutation
	.input(
		z.object({
			id: idSchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const existingUpdate = await getDocOrThrow(ctx, asId<'update'>(input.id), 'Update not found');
		const project = await getDocOrThrow(ctx, existingUpdate.projectId, 'Project not found');
		const access = await verifyProjectAccess(ctx, {
			slug: project.slug,
			userId: ctx.userId,
		});

		if (!access.permissions.canDelete) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You do not have permission to delete this update',
			});
		}

		await deleteCoverImageAttachment(ctx, {
			coverImageId: existingUpdate.coverImageId ?? null,
			orgSlug: project.orgSlug,
		});

		await ctx.orm.delete(updateTable).where(eq(updateTable.id, existingUpdate._id as any));
		return { success: true };
	});

export const bulkPublish = authMutation
	.input(
		z.object({
			ids: idListSchema,
			projectId: idSchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const projectId = asId<'project'>(input.projectId);
		const project = await getDocOrThrow(ctx, projectId, 'Project not found');
		const access = await verifyProjectAccess(ctx, {
			slug: project.slug,
			userId: ctx.userId,
		});

		if (!access.permissions.canEdit) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You do not have permission to publish these updates',
			});
		}
		const timestamp = Date.now();

		for (const id of input.ids) {
			const existingUpdate = await getDocOrThrow(ctx, asId<'update'>(id), 'Update not found');
			if (existingUpdate.projectId !== projectId) {
				throw new CRPCError({
					code: 'BAD_REQUEST',
					message: 'Update does not belong to this project',
				});
			}

			await ctx.orm
				.update(updateTable)
				.set({
					publishedAt: timestamp,
					status: 'published',
					updatedTime: timestamp,
				})
				.where(eq(updateTable.id, existingUpdate._id));
		}

		return { success: true };
	});

export const bulkUnpublish = authMutation
	.input(
		z.object({
			ids: idListSchema,
			projectId: idSchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const projectId = asId<'project'>(input.projectId);
		const project = await getDocOrThrow(ctx, projectId, 'Project not found');
		const access = await verifyProjectAccess(ctx, {
			slug: project.slug,
			userId: ctx.userId,
		});

		if (!access.permissions.canEdit) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You do not have permission to unpublish these updates',
			});
		}
		const timestamp = Date.now();

		for (const id of input.ids) {
			const existingUpdate = await getDocOrThrow(ctx, asId<'update'>(id), 'Update not found');
			if (existingUpdate.projectId !== projectId) {
				throw new CRPCError({
					code: 'BAD_REQUEST',
					message: 'Update does not belong to this project',
				});
			}

			await ctx.orm
				.update(updateTable)
				.set({
					status: 'draft',
					updatedTime: timestamp,
				})
				.where(eq(updateTable.id, existingUpdate._id));
		}

		return { success: true };
	});

export const bulkRemove = authMutation
	.input(
		z.object({
			ids: idListSchema,
			projectId: idSchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const projectId = asId<'project'>(input.projectId);
		const project = await getDocOrThrow(ctx, projectId, 'Project not found');
		const access = await verifyProjectAccess(ctx, {
			slug: project.slug,
			userId: ctx.userId,
		});

		if (!access.permissions.canDelete) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You do not have permission to delete these updates',
			});
		}

		for (const id of input.ids) {
			const existingUpdate = await getDocOrThrow(ctx, asId<'update'>(id), 'Update not found');
			if (existingUpdate.projectId !== projectId) {
				throw new CRPCError({
					code: 'BAD_REQUEST',
					message: 'Update does not belong to this project',
				});
			}

			await deleteCoverImageAttachment(ctx, {
				coverImageId: existingUpdate.coverImageId ?? null,
				orgSlug: project.orgSlug,
			});

			// ORM delete so comments and all emote tables cascade away via FK
			// referential actions (matches the single-update remove path above).
			await ctx.orm.delete(updateTable).where(eq(updateTable.id, existingUpdate._id));
		}

		return { success: true };
	});

export const generateCoverImageUploadUrl = authMutation
	.input(
		z.object({
			updateId: idSchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const existingUpdate = await getDocOrThrow(
			ctx,
			asId<'update'>(input.updateId),
			'Update not found'
		);
		const project = await getDocOrThrow(ctx, existingUpdate.projectId, 'Project not found');
		const access = await verifyProjectAccess(ctx, {
			slug: project.slug,
			userId: ctx.userId,
		});

		if (!access.permissions.canEdit) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You do not have permission to upload cover images for this update',
			});
		}

		return await orgUploadsR2.generateUploadUrl(`UPDATE_COVER_PHOTO.${input.updateId}`);
	});

export const syncMetadata = authMutation
	.input(
		z.object({
			key: storageKeySchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const parts = input.key.split('.');
		if (parts[0] !== 'UPDATE_COVER_PHOTO' || !parts[1]) {
			throw new ConvexError({
				code: '400',
				message: 'Invalid key format for cover image upload',
			});
		}

		const updateId = parts[1] as Id<'update'>;
		const existingUpdate = await ctx.db.get("update", updateId);
		if (!existingUpdate) {
			throw new ConvexError({
				code: '404',
				message: 'Update not found',
			});
		}

		const project = await ctx.db.get("project", existingUpdate.projectId);
		if (!project) {
			throw new ConvexError({
				code: '404',
				message: 'Project not found',
			});
		}

		const access = await verifyProjectAccess(ctx, {
			slug: project.slug,
			userId: ctx.userId,
		});
		if (!access.permissions.canEdit) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You do not have permission to upload cover images for this update',
			});
		}

		await ctx.orm
			.update(updateTable)
			.set({
				coverImageId: input.key,
				updatedTime: Date.now(),
			})
			.where(eq(updateTable.id, updateId));

		await ctx.scheduler.runAfter(0, orgUploadsR2.component.lib.syncMetadata, {
			...orgUploadsR2.config,
			key: input.key,
			onComplete: await createFunctionHandle(internal.update.onCoverImageMetadataSynced),
		});

		return null;
	});

export const clearCoverImage = authMutation
	.input(
		z.object({
			updateId: idSchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const existingUpdate = await getDocOrThrow(
			ctx,
			asId<'update'>(input.updateId),
			'Update not found'
		);
		const project = await getDocOrThrow(ctx, existingUpdate.projectId, 'Project not found');
		const access = await verifyProjectAccess(ctx, {
			slug: project.slug,
			userId: ctx.userId,
		});

		if (!access.permissions.canEdit) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You do not have permission to clear this update cover image',
			});
		}

		await deleteCoverImageAttachment(ctx, {
			coverImageId: existingUpdate.coverImageId ?? null,
			orgSlug: project.orgSlug,
		});

		await ctx.orm
			.update(updateTable)
			.set({
				coverImageId: null,
				updatedTime: Date.now(),
			})
			.where(eq(updateTable.id, existingUpdate._id as any));

		return { success: true };
	});

export const onCoverImageMetadataSynced = internalMutation({
	args: {
		bucket: v.string(),
		isNew: v.boolean(),
		key: v.string(),
	},
	handler: async (ctx, args) => {
		const parts = args.key.split('.');
		if (parts[0] !== 'UPDATE_COVER_PHOTO' || !parts[1]) {
			throw new ConvexError({
				code: '400',
				message: 'Invalid key format for cover image upload',
			});
		}

		const updateId = parts[1] as Id<'update'>;
		const existingUpdate = await ctx.db.get("update", updateId);
		if (!existingUpdate) return;

		const project = await ctx.db.get("project", existingUpdate.projectId);
		if (!project) return;

		const metadata = await getCoverImageR2Metadata(ctx, args.key);
		if (!metadata) return;

		validateCoverImageMetadata(metadata);
		await updateOrgStorageUsage(
			ctx,
			project.orgSlug,
			metadata.size ?? 0,
			args.isNew ? 1 : 0
		);
	},
});

export const getCoverImageUrl = optionalAuthQuery
	.input(
		z.object({
			key: storageKeySchema,
		})
	)
	.query(async ({ ctx, input }) => {
		// Keys are `UPDATE_COVER_PHOTO.<updateId>`. Only resolve a signed URL for a
		// caller who can actually view the owning update — never trust the raw key.
		const parts = input.key.split('.');
		if (parts[0] !== 'UPDATE_COVER_PHOTO' || !parts[1]) return null;

		const updateDoc = await getDoc<'update'>(ctx, asId<'update'>(parts[1]));
		if (!updateDoc) return null;

		const access = await getProjectViewAccess(ctx, {
			id: updateDoc.projectId,
			userId: ctx.userId,
		});
		if (!access.permissions.canView) return null;
		if (updateDoc.status === 'draft' && !access.permissions.canEdit) return null;

		return await resolveCoverImageUrl(input.key);
	});

export const getBySlug = optionalAuthQuery
	.input(
		z.object({
			projectId: idSchema,
			slug: generatedSlugSchema,
		})
	)
	.query(async ({ ctx, input }) => {
		const item = await ctx.db
			.query('update')
			.withIndex('by_projectId_slug', (q: any) =>
				q.eq('projectId', asId<'project'>(input.projectId)).eq('slug', input.slug)
			)
			.first();
		if (!item) return null;

		const project = await getDoc(ctx, asId<'project'>(input.projectId));
		if (!project) return null;

		const access = await verifyProjectAccess(ctx, {
			slug: project.slug,
			userId: ctx.userId,
		});
		if (!access.permissions.canView) {
			return null;
		}
		if (item.status === 'draft' && !access.permissions.canEdit) {
			return null;
		}

		const author = await getDoc<'profile'>(ctx, item.authorProfileId);
		const relatedFeedback = await Promise.all(
			(item.relatedFeedbackIds ?? []).map(async (feedbackId) => {
				const feedback = await getDoc<'feedback'>(ctx, feedbackId);
				if (!feedback) return null;
				const board = await getDoc<'feedbackBoard'>(ctx, feedback.boardId);
				return {
					id: feedback._id,
					board: board
						? {
								id: board._id,
								icon: board.icon,
								name: board.name,
								slug: board.slug,
							}
						: null,
					slug: feedback.slug,
					status: feedback.status,
					title: feedback.title,
				};
			})
		);

		const emotes = await ctx.db
			.query('updateEmote')
			.withIndex('by_updateId', (q: any) => q.eq('updateId', item._id))
			.collect();
		const emoteCounts: Record<string, { authorProfileIds: Array<string>; count: number }> = {};
		for (const emote of emotes) {
			if (!Object.hasOwn(emoteCounts, emote.content)) {
				emoteCounts[emote.content] = { authorProfileIds: [], count: 0 };
			}
			emoteCounts[emote.content].count++;
			emoteCounts[emote.content].authorProfileIds.push(emote.authorProfileId);
		}

		const comments = await ctx.db
			.query('updateComment')
			.withIndex('by_updateId', (q: any) => q.eq('updateId', item._id))
			.collect();

		return {
			author: author
				? {
						id: author._id,
						imageUrl: await resolveProfileImageUrl(author),
						name: author.name,
						username: author.username,
					}
				: null,
			canEdit: access.permissions.canEdit,
			commentCount: comments.length,
			coverImageUrl: await resolveCoverImageUrl(item.coverImageId ?? null),
			emoteCounts,
			relatedFeedback: relatedFeedback.filter(
				(value): value is NonNullable<typeof value> => value !== null
			),
			update: toPublicDoc(item),
		};
	});

export const getDetailCritical = optionalAuthQuery
	.input(
		z.object({
			projectId: idSchema,
			slug: generatedSlugSchema,
		})
	)
	.query(async ({ ctx, input }) => {
		const item = await ctx.db
			.query('update')
			.withIndex('by_projectId_slug', (q: any) =>
				q.eq('projectId', asId<'project'>(input.projectId)).eq('slug', input.slug)
			)
			.first();
		if (!item) return null;

		const access = await getProjectViewAccess(ctx, {
			id: input.projectId,
			userId: ctx.userId,
		});
		if (!access.permissions.canView) return null;
		if (item.status === 'draft' && !access.permissions.canEdit) return null;

		const [author, coverImageUrl, commentWindow, heartCount] = await Promise.all([
			getDoc<'profile'>(ctx, item.authorProfileId),
			resolveCoverImageUrl(item.coverImageId ?? null),
			getUpdateCommentWindow(ctx, { updateId: item._id }),
			ctx.orm.query.updateEmote.count({
				where: { content: 'heart', updateId: item._id },
			}),
		]);
		// Head and tail overlap for short threads, so enrich each unique comment
		// once (sharing author/team-member lookups) instead of twice.
		const cache = createCommentEnrichCache();
		const enrichedById = new Map<string, Awaited<ReturnType<typeof toPublicUpdateComment>>>();
		await Promise.all(
			dedupeDocsById([...commentWindow.head, ...commentWindow.tail]).map(
				async (comment: Doc<'updateComment'>) => {
					enrichedById.set(
						comment._id,
						await toPublicUpdateComment(ctx, comment, input.projectId, access.profile, cache)
					);
				}
			)
		);
		const head = commentWindow.head
			.map((comment: Doc<'updateComment'>) => enrichedById.get(comment._id))
			.filter(Boolean);
		const tail = commentWindow.tail
			.map((comment: Doc<'updateComment'>) => enrichedById.get(comment._id))
			.filter(Boolean);

		return {
			author: await toProfileSummary(author),
			commentWindow: {
				head: dedupeComments(head),
				middleCursor: commentWindow.middleCursor,
				tail: dedupeComments(tail),
				tailCommentIds: commentWindow.tailCommentIds,
			},
			coverImageUrl,
			emoteCounts: {
				heart: {
					authorProfileIds: [],
					count: heartCount,
				},
			},
			update: toPublicDoc(item),
		};
	});

export const getDetailInteractive = optionalAuthQuery
	.input(
		z.object({
			projectId: idSchema,
			updateId: idSchema,
		})
	)
	.query(async ({ ctx, input }) => {
		const item = await getDoc<'update'>(ctx, asId<'update'>(input.updateId));
		if (!item || item.projectId !== asId<'project'>(input.projectId)) {
			return null;
		}

		const access = await getProjectViewAccess(ctx, {
			id: input.projectId,
			userId: ctx.userId,
		});
		if (!access.permissions.canView) return null;
		if (item.status === 'draft' && !access.permissions.canEdit) return null;

		const currentProfile = access.profile;
		const [heartCount, currentProfileHeart, relatedFeedback] = await Promise.all([
			ctx.orm.query.updateEmote.count({
				where: { content: 'heart', updateId: item._id },
			}),
			currentProfile
				? ctx.db
						.query('updateEmote')
						.withIndex('by_updateId_authorProfileId_content', (q: any) =>
							q
								.eq('updateId', item._id)
								.eq('authorProfileId', currentProfile._id)
								.eq('content', 'heart')
						)
						.first()
				: Promise.resolve(null),
			Promise.all(
				(item.relatedFeedbackIds ?? []).map(async (feedbackId) => {
					const feedback = await getDoc<'feedback'>(ctx, feedbackId);
					if (!feedback) return null;
					const board = await getDoc<'feedbackBoard'>(ctx, feedback.boardId);
					return {
						id: feedback._id,
						board: board
							? {
									id: board._id,
									icon: board.icon,
									name: board.name,
									slug: board.slug,
								}
							: null,
						slug: feedback.slug,
						status: feedback.status,
						title: feedback.title,
					};
				})
			),
		]);

		return {
			canEdit: access.permissions.canEdit,
			currentProfile: await toProfileSummary(currentProfile),
			emoteCounts: {
				heart: {
					authorProfileIds: currentProfile && currentProfileHeart ? [currentProfile._id] : [],
					count: heartCount,
				},
			},
			relatedFeedback: relatedFeedback.filter(
				(value): value is NonNullable<typeof value> => value !== null
			),
		};
	});

export const getMiddleComments = optionalAuthQuery
	.input(
		z.object({
			cursor: z.string(),
			limit: z.number().min(1).max(50).optional(),
			tailCommentIds: idArraySchema.optional(),
			updateId: idSchema,
		})
	)
	.query(async ({ ctx, input }) => {
		const item = await getDoc<'update'>(ctx, asId<'update'>(input.updateId));
		if (!item) {
			return { comments: [], nextCursor: null };
		}

		const access = await getProjectViewAccess(ctx, {
			id: item.projectId,
			userId: ctx.userId,
		});
		if (!access.permissions.canView) {
			return { comments: [], nextCursor: null };
		}
		if (item.status === 'draft' && !access.permissions.canEdit) {
			return { comments: [], nextCursor: null };
		}

		const tailIds = new Set(input.tailCommentIds ?? []);
		const page = await ctx.db
			.query('updateComment')
			.withIndex('by_updateId', (q: any) => q.eq('updateId', asId<'update'>(input.updateId)))
			.order('asc')
			.paginate({
				cursor: input.cursor,
				numItems: input.limit ?? MIDDLE_COMMENT_PAGE_SIZE,
			});
		const hitTail = page.page.some((comment: Doc<'updateComment'>) => tailIds.has(comment._id));
		const visibleComments = page.page.filter(
			(comment: Doc<'updateComment'>) => !tailIds.has(comment._id)
		);
		const cache = createCommentEnrichCache();
		const comments = await Promise.all(
			visibleComments.map((comment: Doc<'updateComment'>) =>
				toPublicUpdateComment(ctx, comment, item.projectId, access.profile, cache)
			)
		);

		return {
			comments: dedupeComments(comments),
			nextCursor: hitTail || page.isDone ? null : page.continueCursor,
		};
	});

export const listByProject = optionalAuthQuery
	.input(
		z.object({
			projectId: idSchema,
			category: z.enum(UPDATE_CATEGORIES).optional(),
		})
	)
	.paginated({ limit: 10, item: z.any() })
	.query(async ({ ctx, input }) => {
		const empty = { continueCursor: '', isDone: true, page: [] };

		const project = await getDoc(ctx, asId<'project'>(input.projectId));
		if (!project) {
			return empty;
		}

		const access = await verifyProjectAccess(ctx, {
			slug: project.slug,
			userId: ctx.userId,
		});
		if (!access.permissions.canView) {
			return empty;
		}
		const currentProfile = await getCurrentProfile(ctx, ctx.userId);

		// A new page is loaded each time the reader scrolls, so the per-item author
		// / emote / comment work below is bounded by `input.limit` instead of the
		// whole table (the previous `.collect()` loaded every update at once).
		const query = input.category
			? ctx.db
					.query('update')
					.withIndex('by_projectId_category_status_publishedAt', (q: any) =>
						access.permissions.canEdit
							? q.eq('projectId', project._id).eq('category', input.category)
							: q
									.eq('projectId', project._id)
									.eq('category', input.category)
									.eq('status', 'published')
					)
					.order('desc')
			: ctx.db
					.query('update')
					.withIndex('by_projectId_status_publishedAt', (q: any) =>
						access.permissions.canEdit
							? q.eq('projectId', project._id)
							: q.eq('projectId', project._id).eq('status', 'published')
					)
					.order('desc');

		const result = await query.paginate({
			cursor: input.cursor,
			numItems: input.limit,
		});

		return {
			continueCursor: result.continueCursor,
			isDone: result.isDone,
			page: await Promise.all(
				result.page.map(async (item) => {
					const author = await getDoc<'profile'>(ctx, item.authorProfileId);
					const [heartCount, currentProfileHeart, commentCount] = await Promise.all([
						ctx.orm.query.updateEmote.count({
							where: { content: 'heart', updateId: item._id },
						}),
						currentProfile
							? ctx.db
									.query('updateEmote')
									.withIndex('by_updateId_authorProfileId_content', (q: any) =>
										q
											.eq('updateId', item._id)
											.eq('authorProfileId', currentProfile._id)
											.eq('content', 'heart')
									)
									.first()
							: null,
						ctx.orm.query.updateComment.count({
							where: { updateId: item._id },
						}),
					]);
					const emoteCounts = {
						heart: {
							authorProfileIds: currentProfile && currentProfileHeart ? [currentProfile._id] : [],
							count: heartCount,
						},
					};

					// Keep the list payload and client bundle light: detail pages render
					// the rich HTML body, list pages only need bounded plain text.
					const contentPreview = getUpdateListPreview(item.content);

					return {
						author: author
							? {
									id: author._id,
									imageUrl: await resolveProfileImageUrl(author),
									name: author.name,
									username: author.username,
								}
							: null,
						category: item.category,
						commentCount,
						contentPreview,
						coverImageUrl: await resolveCoverImageUrl(item.coverImageId ?? null),
						emoteCounts,
						id: item._id,
						publishedAt: item.publishedAt,
						slug: item.slug,
						status: item.status,
						title: item.title,
					};
				})
			),
		};
	});

export const listProjectDashboard = authQuery
	.input(
		z.object({
			projectId: idSchema,
		})
	)
	.paginated({ limit: 50, item: z.any() })
	.query(async ({ ctx, input }) => {
		const project = await getDoc(ctx, asId<'project'>(input.projectId));
		if (!project) {
			throw new CRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
		}

		const access = await verifyProjectAccess(ctx, {
			slug: project.slug,
			userId: ctx.userId,
		});
		if (!access.permissions.canEdit) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You do not have permission to manage updates for this project',
			});
		}

		const result = await ctx.db
			.query('update')
			.withIndex('by_projectId_updatedTime', (q: any) => q.eq('projectId', project._id))
			.order('desc')
			.paginate({
				cursor: input.cursor,
				numItems: input.limit,
			});

		return {
			continueCursor: result.continueCursor,
			isDone: result.isDone,
			page: await Promise.all(
				result.page.map(async (item) => {
					const author = await getDoc<'profile'>(ctx, item.authorProfileId);

					return {
						...toPublicDoc(item),
						author: author
							? {
									id: author._id,
									imageUrl: await resolveProfileImageUrl(author),
									name: author.name,
									username: author.username,
								}
							: null,
					};
				})
			),
		};
	});
