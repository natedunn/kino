import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const fileCategory = v.union(
	v.literal('image'),
	v.literal('video'),
	v.literal('document'),
	v.literal('text'),
	v.literal('data'),
	v.literal('package'),
	v.literal('design')
);
export const fileState = v.union(
	v.literal('pending'),
	v.literal('ready'),
	v.literal('deleting'),
	v.literal('deleted')
);
const breakdown = v.record(v.string(), v.object({ bytes: v.number(), files: v.number() }));
export const fileTables = {
	storageProjectPurges: defineTable({ projectId: v.id('projects'), done: v.boolean() })
		.index('by_projectId', ['projectId'])
		.index('by_done', ['done']),
	fileAssets: defineTable({
		projectId: v.id('projects'),
		folderId: v.optional(v.id('fileFolders')),
		name: v.string(),
		normalizedName: v.string(),
		extension: v.string(),
		category: fileCategory,
		searchContent: v.string(),
		extractedText: v.optional(v.string()),
		origin: v.union(v.literal('files'), v.literal('update_cover')),
		uploaderId: v.id('users'),
		uploaderClass: v.union(v.literal('staff'), v.literal('user')),
		access: v.union(v.literal('public'), v.literal('project_staff'), v.literal('private_user')),
		listing: v.union(v.literal('project_files'), v.literal('unlisted')),
		publicId: v.string(),
		state: fileState,
		updatedAt: v.number(),
		objectId: v.optional(v.id('fileObjects')),
		coverUpdateId: v.optional(v.id('updates')),
	})
		.index('by_projectId_and_state_and_folderId', ['projectId', 'state', 'folderId'])
		.index('by_projectId_and_state_and_category', ['projectId', 'state', 'category'])
		.index('by_projectId_and_listing_and_access_and_state', [
			'projectId',
			'listing',
			'access',
			'state',
		])
		.index('by_projectId_and_listing_and_access_and_state_and_normalizedName', [
			'projectId',
			'listing',
			'access',
			'state',
			'normalizedName',
		])
		.index('by_projectId_and_listing_and_access_and_state_and_extension', [
			'projectId',
			'listing',
			'access',
			'state',
			'extension',
		])
		.index('by_projectId_and_listing_and_access_and_state_and_category', [
			'projectId',
			'listing',
			'access',
			'state',
			'category',
		])
		.index('by_projectId_and_listing_and_access_and_state_and_folderId', [
			'projectId',
			'listing',
			'access',
			'state',
			'folderId',
		])
		.index('by_publicId', ['publicId'])
		.index('by_projectId_and_listing_and_access_and_state_and_updatedAt', [
			'projectId',
			'listing',
			'access',
			'state',
			'updatedAt',
		])
		.index('by_coverUpdateId', ['coverUpdateId'])
		.searchIndex('search_by_searchContent', {
			searchField: 'searchContent',
			filterFields: [
				'projectId',
				'state',
				'category',
				'access',
				'listing',
				'extension',
				'folderId',
			],
		}),
	fileObjects: defineTable({
		projectId: v.id('projects'),
		assetId: v.id('fileAssets'),
		stagingKey: v.string(),
		key: v.string(),
		thumbnailKey: v.optional(v.string()),
		thumbnailBytes: v.optional(v.number()),
		declaredBytes: v.number(),
		actualBytes: v.optional(v.number()),
		mimeType: v.string(),
		maxBytes: v.number(),
		state: fileState,
		expiresAt: v.number(),
		settleAfter: v.number(),
		processingAttempt: v.optional(v.string()),
		processingUntil: v.optional(v.number()),
		accounting: v.union(v.literal('reserved'), v.literal('used'), v.literal('released')),
	})
		.index('by_assetId', ['assetId'])
		.index('by_projectId_and_state', ['projectId', 'state']),
	fileFolders: defineTable({
		projectId: v.id('projects'),
		parentId: v.optional(v.id('fileFolders')),
		name: v.string(),
		normalizedName: v.string(),
		systemKey: v.optional(v.union(v.literal('uploads'), v.literal('updates'))),
		updatedAt: v.number(),
	})
		.index('by_projectId_and_parentId_and_normalizedName', [
			'projectId',
			'parentId',
			'normalizedName',
		])
		.index('by_projectId_and_systemKey', ['projectId', 'systemKey']),
	fileReferences: defineTable({
		projectId: v.id('projects'),
		assetId: v.id('fileAssets'),
		updateId: v.id('updates'),
	})
		.index('by_assetId', ['assetId'])
		.index('by_updateId', ['updateId']),
	storageUsage: defineTable({
		projectId: v.id('projects'),
		organizationId: v.id('organizations'),
		usedBytes: v.number(),
		reservedBytes: v.number(),
		fileCount: v.number(),
		byCategory: breakdown,
		byOrigin: breakdown,
		byUploaderClass: breakdown,
	})
		.index('by_projectId', ['projectId'])
		.index('by_organizationId', ['organizationId']),
	storageCleanupJobs: defineTable({
		projectId: v.id('projects'),
		objectId: v.id('fileObjects'),
		state: v.union(
			v.literal('pending'),
			v.literal('running'),
			v.literal('failed'),
			v.literal('done')
		),
		attempt: v.number(),
		maxAttempt: v.number(),
		leaseUntil: v.number(),
		notBefore: v.number(),
		lastError: v.optional(v.string()),
		finishedAt: v.optional(v.number()),
		stagingOnly: v.boolean(),
	})
		.index('by_objectId_and_stagingOnly', ['objectId', 'stagingOnly'])
		.index('by_state', ['state'])
		.index('by_projectId_and_state', ['projectId', 'state']),
};
