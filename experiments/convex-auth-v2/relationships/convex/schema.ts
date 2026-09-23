import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
	users: defineTable({ verified: v.boolean() }),
	organizations: defineTable({ ownerId: v.id('users') }),
	projects: defineTable({
		ownerId: v.id('users'),
		organizationId: v.optional(v.id('organizations')),
		deleting: v.boolean(),
	}),
	boards: defineTable({
		projectId: v.id('projects'),
		name: v.string(),
		deleting: v.optional(v.boolean()),
	}).index('by_projectId', ['projectId']),
	feedback: defineTable({
		projectId: v.id('projects'),
		boardId: v.id('boards'),
		title: v.optional(v.string()),
		searchContent: v.optional(v.string()),
		upvotes: v.optional(v.number()),
		firstCommentId: v.optional(v.id('comments')),
		deleting: v.optional(v.boolean()),
		answerId: v.optional(v.id('comments')),
	})
		.index('by_projectId', ['projectId'])
		.index('by_answerId', ['answerId'])
		.index('by_boardId', ['boardId'])
		.index('by_firstCommentId', ['firstCommentId']),
	comments: defineTable({
		projectId: v.id('projects'),
		feedbackId: v.id('feedback'),
		boardId: v.id('boards'),
		deleting: v.optional(v.boolean()),
		initial: v.optional(v.boolean()),
		content: v.optional(v.string()),
		replyId: v.optional(v.id('comments')),
	})
		.index('by_projectId', ['projectId'])
		.index('by_replyId', ['replyId'])
		.index('by_boardId', ['boardId'])
		.index('by_feedbackId', ['feedbackId']),
	reactions: defineTable({
		projectId: v.id('projects'),
		boardId: v.id('boards'),
		feedbackId: v.id('feedback'),
		commentId: v.id('comments'),
	})
		.index('by_projectId', ['projectId'])
		.index('by_commentId', ['commentId'])
		.index('by_boardId', ['boardId'])
		.index('by_feedbackId', ['feedbackId']),
	votes: defineTable({
		projectId: v.id('projects'),
		boardId: v.id('boards'),
		feedbackId: v.id('feedback'),
		userId: v.id('users'),
	})
		.index('by_projectId', ['projectId'])
		.index('by_boardId', ['boardId'])
		.index('by_feedbackId', ['feedbackId'])
		.index('by_feedbackId_userId', ['feedbackId', 'userId']),
	events: defineTable({
		projectId: v.id('projects'),
		boardId: v.id('boards'),
		feedbackId: v.id('feedback'),
		kind: v.string(),
	})
		.index('by_projectId', ['projectId'])
		.index('by_boardId', ['boardId'])
		.index('by_feedbackId', ['feedbackId']),
	repositories: defineTable({ projectId: v.id('projects'), remoteId: v.string() }).index(
		'by_projectId',
		['projectId']
	),
	links: defineTable({
		projectId: v.id('projects'),
		boardId: v.id('boards'),
		feedbackId: v.id('feedback'),
		repositoryId: v.id('repositories'),
		remoteId: v.string(),
	})
		.index('by_projectId', ['projectId'])
		.index('by_boardId', ['boardId'])
		.index('by_feedbackId', ['feedbackId']),
	projectStorageUsage: defineTable({
		projectId: v.id('projects'),
		usedBytes: v.number(),
		reservedBytes: v.number(),
		fileCount: v.number(),
	}).index('by_projectId', ['projectId']),
	fileAssets: defineTable({
		projectId: v.id('projects'),
		publicId: v.string(),
		size: v.number(),
		state: v.union(
			v.literal('pending'),
			v.literal('ready'),
			v.literal('deleting'),
			v.literal('deleted')
		),
		settleAfter: v.optional(v.number()),
		cleanupJobId: v.optional(v.id('storageCleanupJobs')),
	})
		.index('by_projectId', ['projectId'])
		.index('by_projectId_cleanupJobId', ['projectId', 'cleanupJobId']),
	fileObjects: defineTable({
		projectId: v.id('projects'),
		assetId: v.id('fileAssets'),
		key: v.string(),
		kind: v.union(v.literal('original'), v.literal('public'), v.literal('thumbnail')),
	})
		.index('by_projectId', ['projectId'])
		.index('by_assetId', ['assetId']),
	storageCleanupJobs: defineTable({
		projectId: v.id('projects'),
		projectJobId: v.id('jobs'),
		assetId: v.id('fileAssets'),
		keys: v.array(v.string()),
		cacheTag: v.string(),
		accounting: v.union(v.literal('used'), v.literal('reserved')),
		notBefore: v.number(),
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
	})
		.index('by_projectId', ['projectId'])
		.index('by_projectId_state', ['projectId', 'state'])
		.index('by_assetId', ['assetId']),
	branchJobs: defineTable({
		projectId: v.id('projects'),
		ownerId: v.id('users'),
		kind: v.union(v.literal('board'), v.literal('feedback'), v.literal('comment')),
		rootId: v.string(),
		phase: v.number(),
		version: v.number(),
		processed: v.number(),
		done: v.boolean(),
		scheduledId: v.optional(v.id('_scheduled_functions')),
	}).index('by_kind_rootId', ['kind', 'rootId']),
	folders: defineTable({ projectId: v.id('projects'), parentId: v.optional(v.id('folders')) })
		.index('by_projectId', ['projectId'])
		.index('by_parentId', ['parentId']),
	jobs: defineTable({
		projectId: v.id('projects'),
		ownerId: v.id('users'),
		phase: v.number(),
		version: v.number(),
		processed: v.number(),
		done: v.boolean(),
	}).index('by_projectId', ['projectId']),
});
