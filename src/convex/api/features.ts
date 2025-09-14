import { ConvexError } from 'convex/values';
import z from 'zod';

import { feedbackBoardSelectSchema } from '../schema/feedbackBoard.schema';
import { procedure } from './procedure';
import { getProjectUserData } from './utils/queries/getProjectUserData';

export const feedback = procedure.base.external.query({
	args: {
		projectSlug: z.string(),
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
		} = await getProjectUserData(ctx, {
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
			boards: boards ? feedbackBoardSelectSchema.array().parse(boards) : null,
			feedback: feedback ? feedbackBoardSelectSchema.array().parse(feedback) : null,
		};
	},
});
