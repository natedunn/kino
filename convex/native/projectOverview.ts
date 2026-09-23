import { v } from 'convex/values';

import { query } from './_generated/server';
import { resolveProjectAccess } from './access';

// Keep the overview inexpensive while still giving exact totals for ordinary
// projects. A null total means the collection exceeded this read budget.
const COUNT_LIMIT = 200;
const count = v.union(v.number(), v.null());
const actor = v.union(v.string(), v.null());
const activity = v.object({
	id: v.union(v.id('feedback'), v.id('updates')),
	kind: v.union(v.literal('update_published'), v.literal('feedback_created')),
	actor,
	title: v.string(),
	at: v.number(),
});

export const get = query({
	args: { projectId: v.id('projects') },
	returns: v.union(
		v.null(),
		v.object({
			stats: v.object({
				openFeedback: count,
				upvotes: count,
				inProgress: count,
				publishedUpdates: count,
				members: count,
			}),
			members: v.array(
				v.object({
					id: v.id('users'),
					name: v.string(),
					username: v.string(),
					imageUrl: v.union(v.string(), v.null()),
					role: v.union(
						v.literal('owner'),
						v.literal('admin'),
						v.literal('moderator'),
						v.literal('member')
					),
				})
			),
			recentUpdates: v.array(
				v.object({
					id: v.id('updates'),
					slug: v.string(),
					title: v.string(),
					category: v.union(
						v.literal('changelog'),
						v.literal('article'),
						v.literal('announcement')
					),
					author: actor,
					publishedAt: v.number(),
					commentCount: v.number(),
				})
			),
			activity: v.array(activity),
		})
	),
	handler: async (ctx, { projectId }) => {
		const access = await resolveProjectAccess(ctx, projectId);
		if (!access.project) return null;

		const [feedbackRows, updateRows, owners, admins, directMembers, assignments] =
			await Promise.all([
				ctx.db
					.query('feedback')
					.withIndex('by_projectId', (q) => q.eq('projectId', projectId))
					.order('desc')
					.take(COUNT_LIMIT + 1),
				ctx.db
					.query('updates')
					.withIndex('by_projectId_and_status_and_publishedAt', (q) =>
						q.eq('projectId', projectId).eq('status', 'published')
					)
					.order('desc')
					.take(COUNT_LIMIT + 1),
				ctx.db
					.query('memberships')
					.withIndex('by_organizationId_and_role', (q) =>
						q.eq('organizationId', access.project!.organizationId).eq('role', 'owner')
					)
					.take(COUNT_LIMIT + 1),
				ctx.db
					.query('memberships')
					.withIndex('by_organizationId_and_role', (q) =>
						q.eq('organizationId', access.project!.organizationId).eq('role', 'admin')
					)
					.take(COUNT_LIMIT + 1),
				ctx.db
					.query('projectMembers')
					.withIndex('by_projectId_and_userId', (q) => q.eq('projectId', projectId))
					.take(COUNT_LIMIT + 1),
				ctx.db
					.query('projectModeratorAssignments')
					.withIndex('by_projectId', (q) => q.eq('projectId', projectId))
					.take(COUNT_LIMIT + 1),
			]);

		const feedbackComplete = feedbackRows.length <= COUNT_LIMIT;
		const updatesComplete = updateRows.length <= COUNT_LIMIT;
		const membersComplete =
			owners.length <= COUNT_LIMIT &&
			admins.length <= COUNT_LIMIT &&
			directMembers.length <= COUNT_LIMIT &&
			assignments.length <= COUNT_LIMIT;
		const feedback = feedbackRows.filter((row) => row.deletingAt === undefined);
		const updates = updateRows.filter((row) => row.deletingAt === undefined);
		const moderators = await Promise.all(
			assignments.map((assignment) => ctx.db.get('memberships', assignment.membershipId))
		);
		const team = new Map<
			string,
			{
				userId: (typeof directMembers)[number]['userId'];
				role: 'owner' | 'admin' | 'moderator' | 'member';
			}
		>();
		for (const membership of [...owners, ...admins, ...moderators]) {
			if (!membership || membership.organizationId !== access.project.organizationId) continue;
			team.set(membership.userId, { userId: membership.userId, role: membership.role });
		}
		for (const member of directMembers) {
			if (!team.has(member.userId))
				team.set(member.userId, { userId: member.userId, role: 'member' });
		}
		const memberProfiles = await Promise.all(
			[...team.values()].slice(0, 6).map(async (member) => ({
				...member,
				profile: await ctx.db
					.query('profiles')
					.withIndex('by_userId', (q) => q.eq('userId', member.userId))
					.unique(),
			}))
		);
		const latest = updates.slice(0, 3);
		const recentFeedback = feedback.slice(0, 5);
		const actors = await Promise.all(
			[...latest, ...recentFeedback].map((item) => ctx.db.get('profiles', item.authorProfileId))
		);

		return {
			stats: {
				openFeedback: feedbackComplete
					? feedback.filter((row) => row.status === 'open').length
					: null,
				upvotes: feedbackComplete ? feedback.reduce((total, row) => total + row.upvotes, 0) : null,
				inProgress: feedbackComplete
					? feedback.filter((row) => row.status === 'in-progress').length
					: null,
				publishedUpdates: updatesComplete ? updates.length : null,
				members: membersComplete ? team.size : null,
			},
			members: memberProfiles
				.filter((member) => member.profile !== null)
				.map((member) => ({
					id: member.userId,
					name: member.profile!.name || member.profile!.username,
					username: member.profile!.username,
					imageUrl: member.profile!.imageUrl ?? null,
					role: member.role,
				})),
			recentUpdates: latest.map((item, index) => ({
				id: item._id,
				slug: item.slug,
				title: item.title,
				category: item.category,
				author: actors[index]?.name || actors[index]?.username || null,
				publishedAt: item.publishedAt ?? item._creationTime,
				commentCount: item.commentCount,
			})),
			activity: [
				...latest.map((item, index) => ({
					id: item._id,
					kind: 'update_published' as const,
					actor: actors[index]?.name || actors[index]?.username || null,
					title: item.title,
					at: item.publishedAt ?? item._creationTime,
				})),
				...recentFeedback.map((item, index) => ({
					id: item._id,
					kind: 'feedback_created' as const,
					actor:
						actors[latest.length + index]?.name || actors[latest.length + index]?.username || null,
					title: item.title,
					at: item._creationTime,
				})),
			]
				.sort((a, b) => b.at - a.at)
				.slice(0, 5),
		};
	},
});
