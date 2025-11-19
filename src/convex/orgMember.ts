import { ConvexError } from 'convex/values';

import { components } from './_generated/api';
import { triggers } from './utils/trigger';

triggers.register('orgMember', async (ctx, change) => {
	if (
		change.operation === 'insert' ||
		change.operation === 'update' ||
		change.operation === 'delete'
	) {
		const doc = change.operation === 'delete' ? change.oldDoc : change.newDoc;

		const org = await ctx.runQuery(components.betterAuth.org.get, {
			slug: doc.organizationId,
		});

		if (!org) {
			throw new ConvexError({
				message: 'Organization not found',
				code: '404',
			});
		}

		const projects = await ctx.db
			.query('project')
			.withIndex('by_orgSlug', (q) => q.eq('orgSlug', org.slug))
			.collect();

		projects.forEach(async (project) => {
			const projectMembers = await ctx.db
				.query('projectMember')
				.withIndex('by_profileId_projectId', (q) =>
					q.eq('profileId', doc.profileId).eq('projectId', project._id)
				)
				.collect();

			projectMembers.forEach(async (projectMember) => {
				await ctx.db.patch(projectMember._id, {
					role: change.operation === 'delete' ? doc.role : `org:${doc.role}`,
				});
			});
		});
	}
});
