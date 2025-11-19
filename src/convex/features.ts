import { ConvexError, v } from 'convex/values';

import { feedbackSelectSchema } from './schema/feedback.schema';
import { feedbackBoardSelectSchema } from './schema/feedbackBoard.schema';
import { query } from './utils/functions';
import { checkProjectAccess } from './utils/queries/checkAccess';

export const feedback = query({
	args: {
		projectSlug: v.string(),
	},
	handler: async (ctx, args) => {
		const project = await ctx.db
			.query('project')
			.withIndex('by_slug', (q) => q.eq('slug', args.projectSlug))
			.unique();

		if (!project) {
			return null;
		}

		const {
			permissions: { canView },
		} = await checkProjectAccess(ctx, {
			id: project._id,
		});

		if (!canView) {
			throw new ConvexError({
				message: 'User does not have permission',
				code: '403',
			});
		}

		const boards = await ctx.db
			.query('feedbackBoard')
			.withIndex('by_projectId', (q) => q.eq('projectId', project._id))
			.collect()
			.then((res) =>
				!res || res.length === 0 ? null : feedbackBoardSelectSchema.array().parse(res)
			);

		const feedback = await ctx.db
			.query('feedback')
			.withIndex('by_projectId', (q) => q.eq('projectId', project._id))
			.collect()
			.then(async (res) => {
				if (!res || res.length === 0) {
					return null;
				}

				const parsed = feedbackSelectSchema.array().parse(res);

				const data = await Promise.all(
					parsed.map(async (single) => {
						if (!single.firstCommentId) {
							throw new ConvexError({
								message: 'First comment not found',
								code: '404',
							});
						}
						const firstComment = await ctx.db.get(single.firstCommentId);

						const board = boards?.find((board) => board._id === single.boardId);

						return {
							...single,
							board: board
								? {
										_id: board._id,
										name: board.name,
										description: board?.description,
									}
								: null,
							firstComment,
						};
					})
				);

				return data;
			});

		return {
			boards,
			feedback,
		};
	},
});
