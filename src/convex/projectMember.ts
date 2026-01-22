import { zodToConvex } from 'convex-helpers/server/zod4';
import { v } from 'convex/values';

import { query } from './_generated/server';
import { projectMemberSchema } from './schema/projectMember.schema';

const EDIT_ROLES = ['admin', 'org:admin', 'org:editor'] as const;

export const listAssignableMembers = query({
	args: {
		projectId: v.id('project'),
	},
	handler: async (ctx, { projectId }) => {
		const projectMembers = await ctx.db
			.query('projectMember')
			.withIndex('by_projectId', (q) => q.eq('projectId', projectId))
			.collect();

		// Filter to only members with edit permissions
		const editableMembers = projectMembers.filter((member) =>
			EDIT_ROLES.includes(member.role as (typeof EDIT_ROLES)[number])
		);

		// Get profile data for each member
		const membersWithProfiles = await Promise.all(
			editableMembers.map(async (member) => {
				const profile = await ctx.db.get(member.profileId);
				if (!profile) return null;

				return {
					profileId: member.profileId,
					role: member.role,
					profile: {
						_id: profile._id,
						username: profile.username,
						name: profile.name ?? null,
						imageUrl: profile.imageUrl ?? null,
					},
				};
			})
		);

		return membersWithProfiles.filter((m): m is NonNullable<typeof m> => m !== null);
	},
});
