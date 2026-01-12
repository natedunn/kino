import { zid, zodToConvex } from 'convex-helpers/server/zod4';
import { paginationOptsValidator } from 'convex/server';
import { ConvexError } from 'convex/values';
import * as z from 'zod';

import { Id } from './_generated/dataModel';
import { verifyProjectAccess } from './project.lib';
import {
	feedbackBoardCreateSchema,
	feedbackBoardSelectSchema,
	feedbackBoardUpdateSchema,
} from './schema/feedbackBoard.schema';
import { projectSchema } from './schema/project.schema';
import { mutation, query } from './utils/functions';
import { triggers } from './utils/trigger';
import { verify } from './utils/verify';

export const create = mutation({
	args: zodToConvex(feedbackBoardCreateSchema),
	handler: async (ctx, args) => {
		// Authorization check
		const isProjectAdmin = await verifyProjectAccess(ctx, {
			slug: args.projectId,
		});

		if (!isProjectAdmin) {
			throw new ConvexError({
				message: 'User does not have permission',
				code: '403',
			});
		}

		await verify.defaultValues({
			ctx,
			tableName: 'feedbackBoard',
			data: {
				name: args.slug,
				// slug: args.slug,
				projectId: args.projectId,
			},
		});

		// Insert if passed the authorization checks
		await verify.insert({
			ctx,
			tableName: 'feedbackBoard',
			data: args,
			onFail: (args) => {
				if (args.uniqueRow) {
					throw new ConvexError({
						message: 'Board with this name already exists',
						code: '409',
					});
				}
			},
		});
	},
});

export const update = mutation({
	args: zodToConvex(
		feedbackBoardUpdateSchema.extend(
			z.object({
				projectSlug: z.string(),
				orgSlug: z.string(),
			}).shape
		)
	),
	handler: async (ctx, args) => {
		const { orgSlug, projectSlug, ...data } = args;

		const {
			permissions: { canEdit },
		} = await verifyProjectAccess(ctx, {
			slug: args.projectSlug,
		});

		if (!canEdit) {
			throw new ConvexError({
				message: 'User does not have permission',
				code: '403',
			});
		}

		await verify.patch(ctx, 'feedbackBoard', data._id, data, {
			onFail: ({ uniqueRow }) => {
				if (uniqueRow) {
					throw new ConvexError({
						message: 'Board with this name already exists',
						code: '409',
					});
				}
			},
		});
	},
});

export const get = query({
	args: zodToConvex(
		z.object({
			_id: zid('feedbackBoard').or(z.string()),
			projectSlug: z.string(),
			orgSlug: z.string(),
		})
	),
	handler: async (ctx, args) => {
		const {
			permissions: { canView },
		} = await verifyProjectAccess(ctx, {
			slug: args.projectSlug,
		});

		if (!canView) return null;

		const board = await ctx.db
			.query('feedbackBoard')
			.withIndex('by_id', (q) => q.eq('_id', args._id as Id<'feedbackBoard'>))
			.first();

		if (!board) return null;

		return feedbackBoardSelectSchema.parse(board);
	},
});

export const listProjectBoards = query({
	args: zodToConvex(
		z.object({
			slug: z.string(),
		})
	),
	handler: async (ctx, args) => {
		const {
			permissions: { canView },
			project,
		} = await verifyProjectAccess(ctx, {
			slug: args.slug,
		});

		if (!canView || !project?._id) return null;

		const boards = await ctx.db
			.query('feedbackBoard')
			.withIndex('by_projectId', (q) => q.eq('projectId', project._id))
			.collect();

		return boards;
	},
});

export const _delete = mutation({
	args: zodToConvex(
		z.object({
			boardId: zid('feedbackBoard'),
			projectId: zid('project'),
		})
	),
	handler: async (ctx, args) => {
		const {
			permissions: { canDelete },
		} = await verifyProjectAccess(ctx, {
			id: args.projectId,
		});

		if (!canDelete) {
			throw new ConvexError({
				message: 'User does not have permission',
				code: '403',
			});
		}

		await ctx.db.delete(args.boardId);
	},
});

// Triggers
triggers.register('feedbackBoard', async (ctx, change) => {
	if (change.operation === 'delete') {
		const feedbacks = await ctx.db
			.query('feedback')
			.withIndex('by_projectId_boardId', (q) =>
				q.eq('projectId', change.oldDoc.projectId).eq('boardId', change.oldDoc._id)
			)
			.collect();

		feedbacks.forEach(async (feedback) => {
			await ctx.db.delete(feedback._id);
		});
	}
});
