import { feedbackBoardCreateSchema } from '@/convex/schema/feedbackBoard.schema';

import { procedure } from './procedure';
import { triggers } from './utils/trigger';

export const create = procedure.authed.external.mutation({
	args: feedbackBoardCreateSchema,
	handler: async (ctx, args) => {
		// const member = await auth.api.getActiveMember({
		// 	headers: await betterAuthComponent.getHeaders(ctx),
		// });
		// const project = await ctx.db.get(member?.organizationId);
		// if (!project) {
		// 	throw new ConvexError({
		// 		message: 'Project not found',
		// 		code: '404',
		// 	});
		// }
		// const org = await getOrgBySlug(ctx, project?.orgSlug);
		// console.log('create board: ', args, member?.organizationId);
		// if (!member || (member?.role !== 'admin' && member?.role !== 'owner')) {
		// 	throw new ConvexError({
		// 		message: 'User does not have permission',
		// 		code: '403',
		// 	});
		// }
		// await ctx.db.insert('feedbackBoard', args);
	},
});

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
