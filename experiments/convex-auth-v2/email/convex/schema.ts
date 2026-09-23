import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

import { organizationTables } from '../../organizations/convex/schema';

// Isolated local auth and organization proof.
export default defineSchema({
	...organizationTables,
	counters: defineTable({ userId: v.id('users'), slug: v.string(), value: v.number() }).index(
		'by_userId_and_slug',
		['userId', 'slug']
	),
	users: defineTable({
		email: v.optional(v.string()),
		githubId: v.optional(v.string()),
		githubEmail: v.optional(v.string()),
		githubEmailVerified: v.optional(v.boolean()),
		verified: v.boolean(),
		systemRole: v.optional(v.literal('system:admin')),
		verificationGeneration: v.number(),
		resetGeneration: v.number(),
	}).index('by_email', ['email']),
	challenges: defineTable({
		userId: v.id('users'),
		hash: v.string(),
		purpose: v.union(v.literal('verify'), v.literal('reset')),
		generation: v.number(),
		expiresAt: v.number(),
	}).index('by_hash', ['hash']),
});
