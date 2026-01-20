import { filter } from 'convex-helpers/server/filter';
import { zodToConvex } from 'convex-helpers/server/zod4';
import { OrderedQuery, paginationOptsValidator, Query, QueryInitializer } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { generateRandomSlug } from '@/lib/random';

import { DataModel } from './_generated/dataModel';
import { query } from './_generated/server';
import { getMyProfile } from './profile.lib';
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

		await patch(ctx, 'feedback', args._id, { status: args.status });

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
		const board = await ctx.db.get(args.boardId);

		if (!board || board.projectId !== feedback.projectId) {
			throw new ConvexError({
				message: 'Invalid board',
				code: '400',
			});
		}

		await patch(ctx, 'feedback', args._id, { boardId: args.boardId });

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

		return {
			feedback,
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
						content: firstComment.content,
						authorProfileId: firstComment.authorProfileId,
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

		const getDetails = async (item: (typeof result.page)[number]) => {
			const board = await ctx.db.get(item.boardId);

			const firstComment = item.firstCommentId ? await ctx.db.get(item.firstCommentId) : null;

			return {
				...item,
				board,
				firstComment,
			};
		};

		return {
			...result,
			page: await asyncFlatMapFilter(result.page, getDetails),
		};
	},
});

triggers.register('feedback', async (ctx, change) => {
	if (change.operation === 'delete') {
		const comments = await ctx.db
			.query('feedbackComment')
			.withIndex('by_feedbackId', (q) => q.eq('feedbackId', change.oldDoc._id))
			.collect();

		comments.forEach(async (comment) => {
			await ctx.db.delete(comment._id);
		});
	}
});
