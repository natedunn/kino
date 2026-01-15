import { filter } from 'convex-helpers/server/filter';
import { zodToConvex } from 'convex-helpers/server/zod4';
import { OrderedQuery, paginationOptsValidator, Query, QueryInitializer } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { generateRandomSlug } from '@/lib/random';

import { DataModel } from './_generated/dataModel';
import { query } from './_generated/server';
import { getMyProfile } from './profile.lib';
import { feedbackCreateSchema, feedbackSchema } from './schema/feedback.schema';
import { mutation } from './utils/functions';
import { asyncFlatMapFilter, hasOverlap } from './utils/helpers';
import { triggers } from './utils/trigger';
import { verify } from './utils/verify';

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

		const dv = await verify.defaultValues({
			ctx,
			tableName: 'feedback',
			data: {
				title: args.title,
				projectId: args.projectId,
				boardId: args.boardId,
				authorProfileId: profile._id,
			},
		});

		console.log('defaultValues >>>>>', dv);

		if (!dv) {
			throw new ConvexError({
				message: 'Default values not found',
				code: '404',
			});
		}

		const feedbackId = await verify.insert({
			ctx,
			tableName: 'feedback',
			data: dv,
		});

		console.log('✨ feedbackId >>>>', feedbackId);

		const feedbackCommentId = await verify.insert({
			ctx,
			tableName: 'feedbackComment',
			data: {
				feedbackId: feedbackId,
				authorProfileId: profile._id,
				content: args.firstComment,
				initial: true,
			},
		});

		console.log('✨ feedbackCommentId >>>>', feedbackCommentId);

		await verify.patch(
			ctx,
			'feedback',
			feedbackId,
			{
				firstCommentId: feedbackCommentId,
				searchContent: args.title + ' ' + args.firstComment,
			}
			// {
			// 	onFail: ({ uniqueRow }) => {
			// 		throw new ConvexError({
			// 			code: '500',
			// 			message: 'Unable to patch feedback',
			// 		});
			// 	},
			// }
		);

		return {
			feedbackId,
			feedbackCommentId,
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
