import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';

import { feedbackBoardCreateSchema } from '@/convex/schema/feedbackBoard.schema';

import { procedure } from './procedure';
import { checkUserCanEditProject } from './utils/checks/userCanEditProject';
import { triggers } from './utils/trigger';
import { verify } from './utils/verify';

export const create = procedure.authed.external.mutation({
	args: feedbackBoardCreateSchema,
	handler: async (ctx, args) => {
		// Authorization check
		await checkUserCanEditProject(ctx, {
			userId: ctx.user._id,
			projectId: args.projectId,
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

export const _delete = procedure.authed.external.mutation({
	args: {
		boardId: zid('feedbackBoard'),
		projectId: zid('project'),
	},
	handler: async (ctx, args) => {
		await checkUserCanEditProject(ctx, {
			userId: ctx.user._id,
			projectId: args.projectId,
		});

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
