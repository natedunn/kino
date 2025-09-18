import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import z from 'zod';

import {
	feedbackBoardCreateSchema,
	feedbackBoardSelectSchema,
	feedbackBoardUpdateSchema,
} from '@/convex/schema/feedbackBoard.schema';

import { zAuthedMutation, zQuery } from './utils/functions';
import { getProjectUserDetails } from './utils/queries/getProjectUserDetails';
import { triggers } from './utils/trigger';
import { verify } from './utils/verify';

export const create = zAuthedMutation({
	args: feedbackBoardCreateSchema,
	handler: async (ctx, args) => {
		// Authorization check
		const isProjectAdmin = await getProjectUserDetails(ctx, {
			projectId: args.projectId,
		});

		if (!isProjectAdmin) {
			throw new ConvexError({
				message: 'User does not have permission',
				code: '403',
			});
		}

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

export const update = zAuthedMutation({
	args: feedbackBoardUpdateSchema.merge(
		z.object({
			projectSlug: z.string(),
			orgSlug: z.string(),
		})
	),
	handler: async (ctx, args) => {
		const { orgSlug, projectSlug, ...data } = args;

		// const {
		// 	permissions: { canEdit },
		// } = await getProjectUserData(ctx, {
		// 	projectSlug: args.projectSlug,
		// });

		const canEdit = true;

		if (!canEdit) {
			throw new ConvexError({
				message: 'User does not have permission',
				code: '403',
			});
		}

		await verify.patch({
			ctx,
			tableName: 'feedbackBoard',
			data,
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

export const get = zQuery({
	args: {
		_id: zid('feedbackBoard'),
		projectSlug: z.string(),
		orgSlug: z.string(),
	},
	handler: async (ctx, args) => {
		const {
			permissions: { canView },
		} = await getProjectUserDetails(ctx, {
			projectSlug: args.projectSlug,
		});

		if (!canView) return null;

		const board = await ctx.db.get(args._id);

		if (!board) return null;

		return feedbackBoardSelectSchema.parse(board);
	},
});

export const _delete = zAuthedMutation({
	args: {
		boardId: zid('feedbackBoard'),
		projectId: zid('project'),
	},
	handler: async (ctx, args) => {
		const isProjectAdmin = await getProjectUserDetails(ctx, {
			projectId: args.projectId,
		});

		if (!isProjectAdmin) {
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
			.withIndex('by_board', (q) => q.eq('board', change.oldDoc._id))
			.collect();

		feedbacks.forEach(async (feedback) => {
			await ctx.db.delete(feedback._id);
		});
	}
});
