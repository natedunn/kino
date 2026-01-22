import { filter } from 'convex-helpers/server/filter';
import { zid, zodToConvex } from 'convex-helpers/server/zod4';
import { OrderedQuery, paginationOptsValidator, Query, QueryInitializer } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import * as z from 'zod';

import { generateRandomSlug } from '@/lib/random';

import { DataModel } from './_generated/dataModel';
import { query } from './_generated/server';
import { createEvent } from './feedbackEvent';
import { findMyProfile, getMyProfile } from './profile.lib';
import { verifyProjectAccess } from './project.lib';
import { feedbackCreateSchema, feedbackSchema } from './schema/feedback.schema';
import { mutation } from './utils/functions';
import { asyncFlatMapFilter, hasOverlap } from './utils/helpers';
import { triggers } from './utils/trigger';
import { insert, patch } from './utils/verify';

export const create = mutation({
	args: zodToConvex(feedbackCreateSchema),
	handler: async (ctx, args) => {
		const profile = await getMyProfile(ctx);

		if (!profile) {
			throw new ConvexError({
				message: 'Profile not found',
				code: '404',
			});
		}

		const slug = generateRandomSlug();

		const feedbackId = await insert(ctx, 'feedback', {
			slug,
			title: args.title,
			projectId: args.projectId,
			boardId: args.boardId,
			authorProfileId: profile._id,
		});

		const feedbackCommentId = await insert(ctx, 'feedbackComment', {
			feedbackId: feedbackId,
			authorProfileId: profile._id,
			content: args.firstComment,
			initial: true,
		});

		await patch(ctx, 'feedback', feedbackId, {
			firstCommentId: feedbackCommentId,
			searchContent: args.title + ' ' + args.firstComment,
		});

		return {
			feedbackId,
			feedbackCommentId,
			slug,
		};
	},
});

export const updateStatus = mutation({
	args: zodToConvex(feedbackSchema.pick({ _id: true, status: true })),
	handler: async (ctx, args) => {
		const profile = await getMyProfile(ctx);

		if (!profile) {
			throw new ConvexError({
				message: 'You must be logged in to update feedback status',
				code: '401',
			});
		}

		const feedback = await ctx.db.get(args._id);

		if (!feedback) {
			throw new ConvexError({
				message: 'Feedback not found',
				code: '404',
			});
		}

		// Check if user is the owner
		const isOwner = feedback.authorProfileId === profile._id;

		// Check project permissions
		const project = await ctx.db.get(feedback.projectId);

		if (!project) {
			throw new ConvexError({
				message: 'Project not found',
				code: '404',
			});
		}

		const { permissions } = await verifyProjectAccess(ctx, { slug: project.slug });

		if (!isOwner && !permissions.canEdit) {
			throw new ConvexError({
				message: 'You do not have permission to update this feedback status',
				code: '403',
			});
		}

		const oldStatus = feedback.status;

		await patch(ctx, 'feedback', args._id, { status: args.status });

		// Log the status change event
		if (oldStatus !== args.status) {
			await createEvent(ctx, {
				feedbackId: args._id,
				actorProfileId: profile._id,
				eventType: 'status_changed',
				metadata: {
					oldValue: oldStatus,
					newValue: args.status,
				},
			});
		}

		return { success: true };
	},
});

export const updateBoard = mutation({
	args: zodToConvex(feedbackSchema.pick({ _id: true, boardId: true })),
	handler: async (ctx, args) => {
		const profile = await getMyProfile(ctx);

		if (!profile) {
			throw new ConvexError({
				message: 'You must be logged in to update feedback board',
				code: '401',
			});
		}

		const feedback = await ctx.db.get(args._id);

		if (!feedback) {
			throw new ConvexError({
				message: 'Feedback not found',
				code: '404',
			});
		}

		// Check if user is the owner
		const isOwner = feedback.authorProfileId === profile._id;

		// Check project permissions
		const project = await ctx.db.get(feedback.projectId);

		if (!project) {
			throw new ConvexError({
				message: 'Project not found',
				code: '404',
			});
		}

		const { permissions } = await verifyProjectAccess(ctx, { slug: project.slug });

		if (!isOwner && !permissions.canEdit) {
			throw new ConvexError({
				message: 'You do not have permission to update this feedback board',
				code: '403',
			});
		}

		// Verify the board exists and belongs to the same project
		const newBoard = await ctx.db.get(args.boardId);

		if (!newBoard || newBoard.projectId !== feedback.projectId) {
			throw new ConvexError({
				message: 'Invalid board',
				code: '400',
			});
		}

		const oldBoard = await ctx.db.get(feedback.boardId);

		await patch(ctx, 'feedback', args._id, { boardId: args.boardId });

		// Log the board change event
		if (feedback.boardId !== args.boardId) {
			await createEvent(ctx, {
				feedbackId: args._id,
				actorProfileId: profile._id,
				eventType: 'board_changed',
				metadata: {
					oldValue: oldBoard?.name ?? 'Unknown',
					newValue: newBoard.name,
				},
			});
		}

		return { success: true };
	},
});

const setAnswerCommentSchema = z.object({
	feedbackId: zid('feedback'),
	commentId: zid('feedbackComment').nullable(),
});

const EDIT_ROLES = ['admin', 'org:admin', 'org:editor'] as const;

const updateAssignedSchema = z.object({
	feedbackId: zid('feedback'),
	assignedProfileId: zid('profile').nullable(),
});

export const setAnswerComment = mutation({
	args: zodToConvex(setAnswerCommentSchema),
	handler: async (ctx, args) => {
		const profile = await getMyProfile(ctx);

		if (!profile) {
			throw new ConvexError({
				message: 'You must be logged in to mark a comment as answer',
				code: '401',
			});
		}

		const feedback = await ctx.db.get(args.feedbackId);

		if (!feedback) {
			throw new ConvexError({
				message: 'Feedback not found',
				code: '404',
			});
		}

		// Check if user is the owner
		const isOwner = feedback.authorProfileId === profile._id;

		// Check project permissions
		const project = await ctx.db.get(feedback.projectId);

		if (!project) {
			throw new ConvexError({
				message: 'Project not found',
				code: '404',
			});
		}

		const { permissions } = await verifyProjectAccess(ctx, { slug: project.slug });

		if (!isOwner && !permissions.canEdit) {
			throw new ConvexError({
				message: 'You do not have permission to mark a comment as answer',
				code: '403',
			});
		}

		// If commentId is null, we're unmarking the answer
		if (args.commentId === null) {
			await patch(ctx, 'feedback', args.feedbackId, { answerCommentId: undefined });

			// Log the answer unmarked event
			if (feedback.answerCommentId) {
				await createEvent(ctx, {
					feedbackId: args.feedbackId,
					actorProfileId: profile._id,
					eventType: 'answer_unmarked',
				});
			}

			return { success: true };
		}

		// Validate the comment exists and belongs to this feedback
		const comment = await ctx.db.get(args.commentId);

		if (!comment || comment.feedbackId !== args.feedbackId) {
			throw new ConvexError({
				message: 'Comment not found or does not belong to this feedback',
				code: '400',
			});
		}

		// Cannot mark the initial comment as the answer (it's the question)
		if (comment.initial) {
			throw new ConvexError({
				message: 'Cannot mark the initial comment as the answer',
				code: '400',
			});
		}

		await patch(ctx, 'feedback', args.feedbackId, { answerCommentId: args.commentId });

		// Log the answer marked event
		await createEvent(ctx, {
			feedbackId: args.feedbackId,
			actorProfileId: profile._id,
			eventType: 'answer_marked',
		});

		return { success: true };
	},
});

export const updateAssigned = mutation({
	args: zodToConvex(updateAssignedSchema),
	handler: async (ctx, args) => {
		const profile = await getMyProfile(ctx);

		if (!profile) {
			throw new ConvexError({
				message: 'You must be logged in to assign feedback',
				code: '401',
			});
		}

		const feedback = await ctx.db.get(args.feedbackId);

		if (!feedback) {
			throw new ConvexError({
				message: 'Feedback not found',
				code: '404',
			});
		}

		// Check project permissions - ONLY canEdit, not owner
		const project = await ctx.db.get(feedback.projectId);

		if (!project) {
			throw new ConvexError({
				message: 'Project not found',
				code: '404',
			});
		}

		const { permissions } = await verifyProjectAccess(ctx, { slug: project.slug });

		if (!permissions.canEdit) {
			throw new ConvexError({
				message: 'You do not have permission to assign feedback',
				code: '403',
			});
		}

		// If assigning (not unassigning), validate the assignee is an editable project member
		if (args.assignedProfileId !== null) {
			const assigneeProjectMember = await ctx.db
				.query('projectMember')
				.withIndex('by_profileId_projectId', (q) =>
					q.eq('profileId', args.assignedProfileId!).eq('projectId', feedback.projectId)
				)
				.unique();

			if (!assigneeProjectMember) {
				throw new ConvexError({
					message: 'Assignee must be a project member',
					code: '400',
				});
			}

			if (!EDIT_ROLES.includes(assigneeProjectMember.role as (typeof EDIT_ROLES)[number])) {
				throw new ConvexError({
					message: 'Assignee must have edit permissions',
					code: '400',
				});
			}
		}

		const oldAssignedProfileId = feedback.assignedProfileId;

		await patch(ctx, 'feedback', args.feedbackId, {
			assignedProfileId: args.assignedProfileId ?? undefined,
		});

		// Log the assignment event
		if (args.assignedProfileId === null && oldAssignedProfileId) {
			// Unassigning
			await createEvent(ctx, {
				feedbackId: args.feedbackId,
				actorProfileId: profile._id,
				eventType: 'unassigned',
				metadata: {
					targetProfileId: oldAssignedProfileId,
				},
			});
		} else if (args.assignedProfileId && args.assignedProfileId !== oldAssignedProfileId) {
			// Assigning (new or changed)
			await createEvent(ctx, {
				feedbackId: args.feedbackId,
				actorProfileId: profile._id,
				eventType: 'assigned',
				metadata: {
					targetProfileId: args.assignedProfileId,
				},
			});
		}

		return { success: true };
	},
});

export const getBySlug = query({
	args: zodToConvex(feedbackSchema.pick({ projectId: true, slug: true })),
	handler: async (ctx, { projectId, slug }) => {
		const feedback = await ctx.db
			.query('feedback')
			.withIndex('by_projectId_slug', (q) => q.eq('projectId', projectId).eq('slug', slug))
			.first();

		if (!feedback) {
			return null;
		}

		const author = await ctx.db.get(feedback.authorProfileId);
		const board = await ctx.db.get(feedback.boardId);
		const firstComment = feedback.firstCommentId ? await ctx.db.get(feedback.firstCommentId) : null;
		const assignedProfile = feedback.assignedProfileId
			? await ctx.db.get(feedback.assignedProfileId)
			: null;

		// Check if current user has upvoted this feedback
		const currentProfile = await findMyProfile(ctx);
		let hasUpvoted = false;
		if (currentProfile) {
			const existingUpvote = await ctx.db
				.query('feedbackUpvote')
				.withIndex('by_feedbackId_authorProfileId', (q) =>
					q.eq('feedbackId', feedback._id).eq('authorProfileId', currentProfile._id)
				)
				.unique();
			hasUpvoted = !!existingUpvote;
		}

		return {
			feedback,
			hasUpvoted,
			author: author
				? {
						_id: author._id,
						username: author.username,
						name: author.name,
						imageUrl: author.imageUrl,
					}
				: null,
			board: board
				? {
						_id: board._id,
						name: board.name,
						slug: board.slug,
						icon: board.icon,
					}
				: null,
			firstComment: firstComment
				? {
						_id: firstComment._id,
						_creationTime: firstComment._creationTime,
						updatedTime: firstComment.updatedTime,
						content: firstComment.content,
						authorProfileId: firstComment.authorProfileId,
					}
				: null,
			assignedProfile: assignedProfile
				? {
						_id: assignedProfile._id,
						username: assignedProfile.username,
						name: assignedProfile.name,
						imageUrl: assignedProfile.imageUrl,
					}
				: null,
		};
	},
});

export const listProjectFeedback = query({
	args: {
		projectId: v.id('project'),
		boardId: v.union(v.id('feedbackBoard'), v.literal('all')),
		order: v.optional(v.union(v.literal('desc'), v.literal('asc'))),
		search: v.optional(v.string()),
		status: zodToConvex(feedbackSchema.shape.status.optional()),
		tags: zodToConvex(feedbackSchema.shape.tags.optional()),
		paginationOpts: paginationOptsValidator,
	},
	handler: async (
		ctx,
		{ projectId, boardId: board, order: order, tags, status, search, paginationOpts }
	) => {
		const boardId = board === 'all' ? undefined : board;

		const tableQuery: QueryInitializer<DataModel['feedback']> = ctx.db.query('feedback');

		let indexedQuery: Query<DataModel['feedback']> = tableQuery;

		if (boardId && !status && !search) {
			indexedQuery = tableQuery.withIndex('by_projectId_boardId', (q) =>
				q.eq('projectId', projectId).eq('boardId', boardId)
			);
		}

		if (!boardId && status && !search) {
			indexedQuery = tableQuery.withIndex('by_projectId_status', (q) =>
				q.eq('projectId', projectId).eq('status', status)
			);
		}

		if (boardId && status && !search) {
			indexedQuery = tableQuery.withIndex('by_projectId_boardId_status', (q) =>
				q.eq('projectId', projectId).eq('boardId', boardId).eq('status', status)
			);
		}

		if (!boardId && !status && !search) {
			indexedQuery = tableQuery.withIndex('by_projectId', (q) => q.eq('projectId', projectId));
		}

		let orderedQuery: OrderedQuery<DataModel['feedback']> = indexedQuery;
		orderedQuery = indexedQuery.order(order ?? 'desc');

		if (!boardId && !status && search) {
			orderedQuery = tableQuery.withSearchIndex('by_projectId_boardId_status_searchContent', (q) =>
				q
					.search('searchContent', search) //
					.eq('projectId', projectId)
			);
		}

		if (boardId && !status && search) {
			orderedQuery = tableQuery.withSearchIndex('by_projectId_boardId_status_searchContent', (q) =>
				q
					.search('searchContent', search) //
					.eq('projectId', projectId)
					.eq('boardId', boardId)
			);
		}

		if (!boardId && status && search) {
			orderedQuery = tableQuery.withSearchIndex('by_projectId_boardId_status_searchContent', (q) =>
				q
					.search('searchContent', search) //
					.eq('projectId', projectId)
					.eq('status', status)
			);
		}

		if (boardId && status && search) {
			orderedQuery = tableQuery.withSearchIndex('by_projectId_boardId_status_searchContent', (q) =>
				q
					.search('searchContent', search) //
					.eq('projectId', projectId)
					.eq('boardId', boardId)
					.eq('status', status)
			);
		}

		if (tags) {
			orderedQuery = filter(orderedQuery, (q) => {
				return q?.tags ? hasOverlap(q.tags, tags) : false;
			});
		}

		const result = await orderedQuery.paginate(paginationOpts);

		// Get current user's profile for upvote status
		const currentProfile = await findMyProfile(ctx);

		const getDetails = async (item: (typeof result.page)[number]) => {
			const board = await ctx.db.get(item.boardId);

			const firstComment = item.firstCommentId ? await ctx.db.get(item.firstCommentId) : null;

			// Check if current user has upvoted this feedback
			let hasUpvoted = false;
			if (currentProfile) {
				const existingUpvote = await ctx.db
					.query('feedbackUpvote')
					.withIndex('by_feedbackId_authorProfileId', (q) =>
						q.eq('feedbackId', item._id).eq('authorProfileId', currentProfile._id)
					)
					.unique();
				hasUpvoted = !!existingUpvote;
			}

			return {
				...item,
				board,
				firstComment,
				hasUpvoted,
			};
		};

		return {
			...result,
			page: await asyncFlatMapFilter(result.page, getDetails),
		};
	},
});

// Search feedback for linking to updates (async search)
export const searchForLinking = query({
	args: {
		projectId: v.id('project'),
		search: v.string(),
	},
	returns: v.array(
		v.object({
			_id: v.id('feedback'),
			title: v.string(),
			slug: v.string(),
			status: zodToConvex(feedbackSchema.shape.status),
			board: v.union(
				v.object({
					_id: v.id('feedbackBoard'),
					name: v.string(),
				}),
				v.null()
			),
		})
	),
	handler: async (ctx, { projectId, search }) => {
		let feedback;

		if (search.trim()) {
			// Use search index for text search
			feedback = await ctx.db
				.query('feedback')
				.withSearchIndex('by_projectId_boardId_status_searchContent', (q) =>
					q.search('searchContent', search).eq('projectId', projectId)
				)
				.take(20);
		} else {
			// Return recent items when no search term
			feedback = await ctx.db
				.query('feedback')
				.withIndex('by_projectId', (q) => q.eq('projectId', projectId))
				.order('desc')
				.take(20);
		}

		return Promise.all(
			feedback.map(async (item) => {
				const board = await ctx.db.get(item.boardId);
				return {
					_id: item._id,
					title: item.title,
					slug: item.slug,
					status: item.status,
					board: board ? { _id: board._id, name: board.name } : null,
				};
			})
		);
	},
});

// Get feedback items by IDs (for displaying selected items)
export const getByIds = query({
	args: {
		ids: v.array(v.id('feedback')),
	},
	returns: v.array(
		v.object({
			_id: v.id('feedback'),
			title: v.string(),
			slug: v.string(),
			status: zodToConvex(feedbackSchema.shape.status),
			board: v.union(
				v.object({
					_id: v.id('feedbackBoard'),
					name: v.string(),
				}),
				v.null()
			),
		})
	),
	handler: async (ctx, { ids }) => {
		if (ids.length === 0) return [];

		const results = await Promise.all(
			ids.map(async (id) => {
				const item = await ctx.db.get(id);
				if (!item) return null;
				const board = await ctx.db.get(item.boardId);
				return {
					_id: item._id,
					title: item.title,
					slug: item.slug,
					status: item.status,
					board: board ? { _id: board._id, name: board.name } : null,
				};
			})
		);

		return results.filter((item): item is NonNullable<typeof item> => item !== null);
	},
});

triggers.register('feedback', async (ctx, change) => {
	if (change.operation === 'delete') {
		// Delete associated comments
		const comments = await ctx.db
			.query('feedbackComment')
			.withIndex('by_feedbackId', (q) => q.eq('feedbackId', change.oldDoc._id))
			.collect();

		for (const comment of comments) {
			await ctx.db.delete(comment._id);
		}

		// Delete associated upvotes
		const upvotes = await ctx.db
			.query('feedbackUpvote')
			.withIndex('by_feedbackId', (q) => q.eq('feedbackId', change.oldDoc._id))
			.collect();

		for (const upvote of upvotes) {
			await ctx.db.delete(upvote._id);
		}
	}
});
