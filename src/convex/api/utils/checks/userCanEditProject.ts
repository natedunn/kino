import { GenericQueryCtx } from 'convex/server';
import { ConvexError } from 'convex/values';

import { components } from '@/convex/_generated/api';
import { DataModel, Id } from '@/convex/_generated/dataModel';

import { getInternalUserId, getOrgBySlug } from '../queries';

export const checkUserCanEditProject = async (
	ctx: GenericQueryCtx<DataModel>,
	{
		userId,
		projectId,
	}: {
		userId: Id<'user'>;
		projectId: Id<'project'>;
	}
) => {
	// Get user
	const internalUserId = await getInternalUserId(ctx, userId);

	// Get project and org details
	const project = await ctx.db.get(projectId);
	if (!project) {
		throw new ConvexError({
			message: 'Project not found',
			code: '404',
		});
	}

	const org = await getOrgBySlug(ctx, project?.orgSlug);
	if (!org) {
		throw new ConvexError({
			message: 'Organization not found',
			code: '404',
		});
	}

	// Check if user admin or owner
	const member = await ctx.runQuery(components.betterAuth.lib.findOne, {
		model: 'member',
		where: [
			{ field: 'userId', operator: 'eq', value: internalUserId },
			{
				field: 'organizationId',
				operator: 'eq',
				value: org._id,
			},
			{
				field: 'role',
				operator: 'in',
				value: ['admin', 'owner'],
			},
		],
	});

	if (!member) {
		// If the user is not a admin or owner of the org, we will check for project permissions
		const projectUser = await ctx.db
			.query('projectUser')
			.withIndex('by_userId_projectId_role', (q) =>
				q.eq('userId', userId).eq('projectId', projectId).eq('role', 'admin')
			)
			.unique();

		if (!projectUser) {
			throw new ConvexError({
				message: 'User does not have permission',
				code: '403',
			});
		}
	}
};
