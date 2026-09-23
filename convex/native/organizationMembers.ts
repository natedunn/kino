import { ConvexError, v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { requireOrganizationManager } from './access';
import { MAX_PROJECT_ASSIGNMENTS, validateOrganizationProjects } from './organizations';
import { projectVisibility } from './schema';

export const getModeratorProjectAccess = query({
	args: { memberId: v.id('memberships') },
	returns: v.object({
		memberId: v.id('memberships'),
		projects: v.array(
			v.object({
				id: v.id('projects'),
				name: v.string(),
				slug: v.string(),
				visibility: projectVisibility,
				assigned: v.boolean(),
			})
		),
	}),
	handler: async (ctx, { memberId }) => {
		const member = await ctx.db.get('memberships', memberId);
		if (!member) throw new ConvexError('MEMBERSHIP_NOT_FOUND');
		await requireOrganizationManager(ctx, member.organizationId);
		const projects = await ctx.db
			.query('projects')
			.withIndex('by_organizationId', (q) => q.eq('organizationId', member.organizationId))
			.take(MAX_PROJECT_ASSIGNMENTS + 1);
		const assignments = await ctx.db
			.query('projectModeratorAssignments')
			.withIndex('by_membershipId_and_projectId', (q) => q.eq('membershipId', memberId))
			.take(MAX_PROJECT_ASSIGNMENTS + 1);
		if (projects.length > MAX_PROJECT_ASSIGNMENTS || assignments.length > MAX_PROJECT_ASSIGNMENTS)
			throw new ConvexError('ASSIGNMENT_LIMIT');
		const assigned = new Set(assignments.map((row) => row.projectId));
		return {
			memberId,
			projects: projects
				.filter((project) => project.deletingAt === undefined)
				.map((project) => ({
					id: project._id,
					name: project.name,
					slug: project.slug,
					visibility: project.visibility,
					assigned: assigned.has(project._id),
				})),
		};
	},
});

// Existing moderators may have all grants revoked without changing their role.
// Invitations and transitions into moderator still require at least one project.
export const setModeratorProjectAccess = mutation({
	args: { memberId: v.id('memberships'), projectIds: v.array(v.id('projects')) },
	returns: v.null(),
	handler: async (ctx, { memberId, projectIds }) => {
		const member = await ctx.db.get('memberships', memberId);
		if (!member) throw new ConvexError('MEMBERSHIP_NOT_FOUND');
		await requireOrganizationManager(ctx, member.organizationId);
		if (member.role !== 'moderator') throw new ConvexError('FORBIDDEN');
		if (projectIds.length)
			await validateOrganizationProjects(ctx, member.organizationId, 'moderator', projectIds);
		const assignments = await ctx.db
			.query('projectModeratorAssignments')
			.withIndex('by_membershipId_and_projectId', (q) => q.eq('membershipId', memberId))
			.take(MAX_PROJECT_ASSIGNMENTS + 1);
		if (assignments.length > MAX_PROJECT_ASSIGNMENTS) throw new ConvexError('ASSIGNMENT_LIMIT');
		for (const row of assignments) await ctx.db.delete('projectModeratorAssignments', row._id);
		for (const projectId of projectIds)
			await ctx.db.insert('projectModeratorAssignments', { membershipId: memberId, projectId });
		return null;
	},
});
