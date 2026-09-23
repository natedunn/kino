import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
	tenants: defineTable({
		owner: v.string(),
		used: v.number(),
		reserved: v.number(),
		count: v.number(),
	}),
	assets: defineTable({
		tenantId: v.id('tenants'),
		name: v.string(),
		publicId: v.string(),
		key: v.string(),
		bytes: v.number(),
		state: v.union(
			v.literal('ready'),
			v.literal('pending'),
			v.literal('deleting'),
			v.literal('deleted')
		),
		accounting: v.union(v.literal('used'), v.literal('reserved')),
		uploadGrantId: v.optional(v.id('uploadGrants')),
		jobId: v.optional(v.id('cleanup')),
	}),
	uploadGrants: defineTable({
		assetId: v.id('assets'),
		tenantId: v.id('tenants'),
		stagingKey: v.string(),
		state: v.union(v.literal('open'), v.literal('completed'), v.literal('revoked')),
		expiresAt: v.number(),
		settleAfter: v.number(),
	}).index('by_asset', ['assetId']),
	references: defineTable({ assetId: v.id('assets') }).index('by_asset', ['assetId']),
	cleanup: defineTable({
		assetId: v.id('assets'),
		tenantId: v.id('tenants'),
		keys: v.array(v.string()),
		cacheTag: v.string(),
		notBefore: v.number(),
		bytes: v.number(),
		accounting: v.union(v.literal('used'), v.literal('reserved')),
		state: v.union(
			v.literal('pending'),
			v.literal('running'),
			v.literal('failed'),
			v.literal('done')
		),
		attempt: v.number(),
		maxAttempt: v.number(),
		leaseUntil: v.number(),
		lastError: v.optional(v.string()),
	}).index('by_asset', ['assetId']),
});
