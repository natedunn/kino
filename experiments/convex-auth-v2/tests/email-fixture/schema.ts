import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

// Test-only app schema. No live deployment imports this fixture.
export default defineSchema({
	users: defineTable({
		email: v.string(),
		verified: v.boolean(),
		verificationGeneration: v.number(),
		resetGeneration: v.number(),
		rejectSignIn: v.optional(v.boolean()),
		rejectResetCompletion: v.optional(v.boolean()),
	}).index('by_email', ['email']),
	challenges: defineTable({
		userId: v.id('users'),
		hash: v.string(),
		purpose: v.union(v.literal('verify'), v.literal('reset')),
		generation: v.number(),
		expiresAt: v.number(),
	}).index('by_hash', ['hash']),
});
