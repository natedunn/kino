import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const assignableRole = v.union(v.literal('admin'), v.literal('moderator'));
export const organizationTables = {
	invitations: defineTable({
		organizationId: v.id('organizations'),
		email: v.string(),
		role: assignableRole,
		projectIds: v.array(v.id('projects')),
		inviterId: v.id('users'),
		deliveryStatus: v.optional(v.union(v.literal('accepted'), v.literal('failed'))),
		expiresAt: v.number(),
		status: v.union(
			v.literal('pending'),
			v.literal('accepted'),
			v.literal('cancelled'),
			v.literal('rejected'),
			v.literal('expired')
		),
		acceptedBy: v.optional(v.id('users')),
		membershipId: v.optional(v.id('memberships')),
	}).index('by_organizationId_email_status', ['organizationId', 'email', 'status']),
	organizations: defineTable({
		name: v.string(),
		slug: v.string(),
		visibility: v.optional(v.union(v.literal('public'), v.literal('private'))),
	}).index('by_slug', ['slug']),
	memberships: defineTable({
		organizationId: v.id('organizations'),
		userId: v.id('users'),
		role: v.union(v.literal('owner'), assignableRole),
	})
		.index('by_organizationId_userId', ['organizationId', 'userId'])
		.index('by_userId', ['userId'])
		.index('by_organizationId_role', ['organizationId', 'role']),
	projects: defineTable({
		organizationId: v.id('organizations'),
		name: v.string(),
		value: v.number(),
		visibility: v.optional(
			v.union(v.literal('public'), v.literal('private'), v.literal('archived'))
		),
	}),
	projectMembers: defineTable({ projectId: v.id('projects'), userId: v.id('users') }).index(
		'by_projectId_userId',
		['projectId', 'userId']
	),
	assignments: defineTable({
		membershipId: v.id('memberships'),
		projectId: v.id('projects'),
	})
		.index('by_membershipId_projectId', ['membershipId', 'projectId'])
		.index('by_projectId', ['projectId']),
};
export default defineSchema({
	...organizationTables,
	users: defineTable({
		verified: v.boolean(),
		systemRole: v.optional(v.literal('system:admin')),
		email: v.optional(v.string()),
		githubEmail: v.optional(v.string()),
		githubEmailVerified: v.optional(v.boolean()),
	}),
});
