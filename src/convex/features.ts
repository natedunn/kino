import { ConvexError, v } from 'convex/values';

import { feedbackSelectSchema } from './schema/feedback.schema';
import { feedbackBoardSelectSchema } from './schema/feedbackBoard.schema';
import { query } from './utils/functions';
import { getProjectUserDetails } from './utils/queries/getProjectUserDetails';

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
		} = await getProjectUserDetails(ctx, {
			projectId: project._id,
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
			.collect();

		const feedback = await ctx.db
			.query('feedback')
			.withIndex('by_projectId', (q) => q.eq('projectId', project._id))
			.collect();

		return {
			boards: boards && boards.length > 0 ? feedbackBoardSelectSchema.array().parse(boards) : null,
			feedback:
				feedback && feedback.length > 0 ? feedbackSelectSchema.array().parse(feedback) : null,
		};
	},
});
