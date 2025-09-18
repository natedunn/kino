import { ConvexError } from 'convex/values';
import z from 'zod';

import { feedbackBoardSelectSchema } from './schema/feedbackBoard.schema';
import { zQuery } from './utils/functions';
import { getProjectUserDetails } from './utils/queries/getProjectUserDetails';

// export const Test = zQuery({
// 	args: {},
// 	handler: async (ctx) => {
// 		const test = await  ctx.runQuery(components.betterAuth.lib.findOne, {
// 			model: 'user',

// 		})
// 	}
// })

export const feedback = zQuery({
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
			boards: boards ? feedbackBoardSelectSchema.array().parse(boards) : null,
			feedback: feedback ? feedbackBoardSelectSchema.array().parse(feedback) : null,
		};
	},
});
