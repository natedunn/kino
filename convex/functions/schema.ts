import type { AnyColumn } from 'kitcn/orm';

import {
	aggregateIndex,
	arrayOf,
	boolean,
	convexTable,
	defineSchema,
	id,
	index,
	integer,
	json,
	objectOf,
	searchIndex,
	text,
	textEnum,
	timestamp,
} from 'kitcn/orm';

import { normalizeSlug, VALIDATION_LIMITS } from '../lib/validation';
import {
	FILE_ACCESS_LEVELS,
	FILE_CATEGORIES,
	FILE_CREATION_METHODS,
	FILE_LISTINGS,
	FILE_ORIGIN_FEATURES,
	FILE_SOURCE_PROVIDERS,
	FILE_UPLOADER_CLASSES,
} from '../shared/files';
import { APP_LOCALES } from '../shared/i18n';
import { targetGranularities } from '../shared/target';

// Compatibility-deploy shape: `system:editor` remains schema-valid until the
// downgrade migration rewrites existing profiles. Authorization treats it as
// `user` immediately.
const PROFILE_ROLES = ['system:admin', 'system:editor', 'user'] as const;
const PROJECT_VISIBILITIES = ['public', 'private', 'archived'] as const;
const PROJECT_THEME_PRESETS = [
	'kino',
	'red',
	'orange',
	'golden',
	'forest',
	'teal',
	'purple',
	'sunset',
	'monochrome',
	'custom',
] as const;
// `ocean` and the draft columns below are accepted only while legacy rows are
// cleaned up. They are not exposed by the current theme editor or write API.
const STORED_PROJECT_THEME_PRESETS = [...PROJECT_THEME_PRESETS, 'ocean'] as const;
// Compatibility-deploy shape: new direct project members omit `role`; legacy
// values remain accepted until the cleanup migration removes org-derived rows
// and unsets `member`.
const PROJECT_MEMBER_ROLES = ['member', 'org:admin', 'org:editor'] as const;
const FEEDBACK_STATUSES = ['open', 'in-progress', 'closed', 'completed', 'paused'] as const;
const FEEDBACK_PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'] as const;
const FEEDBACK_EVENT_TYPES = [
	'status_changed',
	'priority_changed',
	'board_changed',
	'assigned',
	'unassigned',
	'title_changed',
	'answer_marked',
	'answer_unmarked',
] as const;
const UPDATE_STATUSES = ['draft', 'published'] as const;
export const UPDATE_CATEGORIES = ['changelog', 'article', 'announcement'] as const;
const GITHUB_SYNC_MODES = ['read', 'read_write'] as const;
const GITHUB_CONNECTION_STATE_STATUSES = ['pending', 'consumed', 'expired'] as const;
const GITHUB_INSTALLATION_STATUSES = ['active', 'suspended', 'stale', 'deleted'] as const;
const FEEDBACK_GITHUB_CONNECTION_KINDS = ['issue'] as const;
const FILE_OBJECT_STATUSES = ['pending', 'ready', 'rejected', 'deleted'] as const;
const FILE_STORAGE_PROVIDERS = ['r2', 'external'] as const;
const FILE_BUCKET_KINDS = ['org_uploads', 'user_uploads', 'external'] as const;
const FILE_THUMBNAIL_BUCKET_KINDS = ['org_uploads', 'user_uploads'] as const;
const FILE_THUMBNAIL_STATUSES = ['pending', 'ready', 'failed'] as const;
export const EMOTE_CONTENTS = [
	'thumbsUp',
	'thumbsDown',
	'laugh',
	'questionMark',
	'sad',
	'tada',
	'eyes',
	'heart',
	'skull',
	'explodingHead',
] as const;
const urlField = arrayOf(
	objectOf({
		url: text().notNull(),
		text: text().notNull(),
	})
);

// Project links carry provenance for the "verified" badge on top of the base
// url/label: `{ url, text, source?, verifiedAt? }`. `source` absent/"manual" =
// user-entered; "github" = imported from a connected GitHub repo (server-owned,
// read-only). `verifiedAt` is the import timestamp, only set for github links.
//
// Stored as `v.any()` elements on purpose: `objectOf` forces every declared
// field to a required key, which would reject the pre-existing `{ url, text }`
// rows on schema push. `v.any()` keeps old and new shapes valid; the write
// shape is enforced by the mutations + `urlListSchema` instead.
const projectUrlField = arrayOf(json());

// Moderator access is intentionally independent from direct private-project
// membership. A member-role change only removes grants; it never creates or
// restores them.
async function deleteModeratorAccessForMember(ctx: any, memberId: string) {
	const assignments = await ctx.db
		.query('projectModeratorAccess')
		.withIndex('by_memberId_and_projectId', (q: any) => q.eq('memberId', memberId))
		.take(200);
	await Promise.all(
		assignments.map((assignment: any) => ctx.db.delete('projectModeratorAccess', assignment._id))
	);
}

async function deletePendingModeratorAccessForInvitation(ctx: any, invitationId: string) {
	const assignments = await ctx.db
		.query('pendingModeratorProjectAccess')
		.withIndex('by_invitationId_and_projectId', (q: any) => q.eq('invitationId', invitationId))
		.take(200);
	await Promise.all(
		assignments.map((assignment: any) =>
			ctx.db.delete('pendingModeratorProjectAccess', assignment._id)
		)
	);
}

export const userTable = convexTable(
	'user',
	{
		name: text().notNull(),
		email: text().notNull().unique(),
		emailVerified: boolean().notNull(),
		image: text(),
		createdAt: timestamp().notNull(),
		updatedAt: timestamp().notNull(),
		userId: text(),
		username: text(),
		displayUsername: text(),
		role: text(),
		banned: boolean(),
		banReason: text(),
		banExpires: integer(),
		profileId: text(),
	},
	(table) => [
		index('email_name').on(table.email, table.name),
		index('name').on(table.name),
		index('userId').on(table.userId),
		index('username').on(table.username),
		index('profileId').on(table.profileId),
	]
);

export const sessionTable = convexTable(
	'session',
	{
		expiresAt: timestamp().notNull(),
		token: text().notNull().unique(),
		createdAt: timestamp().notNull(),
		updatedAt: timestamp().notNull(),
		ipAddress: text(),
		userAgent: text(),
		userId: text()
			.notNull()
			.references(() => userTable.id),
		impersonatedBy: text(),
		activeOrganizationId: text(),
	},
	(table) => [
		index('expiresAt').on(table.expiresAt),
		index('expiresAt_userId').on(table.expiresAt, table.userId),
		index('userId').on(table.userId),
	]
);

export const accountTable = convexTable(
	'account',
	{
		accountId: text().notNull(),
		// Better Auth 1.7 keys accounts by the stable compound identity.
		issuer: text().notNull(),
		providerId: text().notNull(),
		userId: text()
			.notNull()
			.references(() => userTable.id),
		accessToken: text(),
		refreshToken: text(),
		idToken: text(),
		accessTokenExpiresAt: timestamp(),
		refreshTokenExpiresAt: timestamp(),
		scope: text(),
		password: text(),
		createdAt: timestamp().notNull(),
		updatedAt: timestamp().notNull(),
	},
	(table) => [
		index('accountId').on(table.accountId),
		index('issuer_accountId').on(table.issuer, table.accountId),
		index('accountId_issuer').on(table.accountId, table.issuer),
		index('accountId_providerId').on(table.accountId, table.providerId),
		index('providerId_userId').on(table.providerId, table.userId),
		index('userId').on(table.userId),
	]
);

export const verificationTable = convexTable(
	'verification',
	{
		identifier: text().notNull(),
		value: text().notNull(),
		expiresAt: timestamp().notNull(),
		createdAt: timestamp().notNull(),
		updatedAt: timestamp().notNull(),
	},
	(table) => [index('expiresAt').on(table.expiresAt), index('identifier').on(table.identifier)]
);

export const organizationTable = convexTable(
	'organization',
	{
		name: text().notNull(),
		slug: text().notNull(),
		logo: text(),
		createdAt: timestamp().notNull(),
		metadata: text(),
		visibility: text().notNull(),
	},
	(table) => [index('name').on(table.name), index('slug').on(table.slug)]
);

export const memberTable = convexTable(
	'member',
	{
		organizationId: text()
			.notNull()
			.references(() => organizationTable.id),
		userId: text()
			.notNull()
			.references(() => userTable.id),
		role: text().notNull(),
		createdAt: timestamp().notNull(),
	},
	(table) => [
		index('organizationId').on(table.organizationId),
		index('userId').on(table.userId),
		index('role').on(table.role),
		index('userId_organizationId').on(table.userId, table.organizationId),
		// better-auth organization plugin queries members by these composites
		index('organizationId_userId').on(table.organizationId, table.userId),
		index('organizationId_role').on(table.organizationId, table.role),
	]
);

export const invitationTable = convexTable(
	'invitation',
	{
		organizationId: text()
			.notNull()
			.references(() => organizationTable.id),
		email: text().notNull(),
		role: text(),
		status: text().notNull(),
		expiresAt: timestamp().notNull(),
		createdAt: timestamp().notNull(),
		inviterId: text()
			.notNull()
			.references(() => userTable.id),
	},
	(table) => [
		index('organizationId').on(table.organizationId),
		index('email').on(table.email),
		index('role').on(table.role),
		index('status').on(table.status),
		index('inviterId').on(table.inviterId),
		// better-auth organization plugin queries invitations by these composites
		index('email_organizationId_status').on(table.email, table.organizationId, table.status),
		index('organizationId_status').on(table.organizationId, table.status),
	]
);

export const jwksTable = convexTable('jwks', {
	publicKey: text().notNull(),
	privateKey: text().notNull(),
	createdAt: timestamp().notNull(),
	expiresAt: timestamp(),
	// Better Auth 1.7 records the generated key algorithm/curve. Both remain
	// optional so keys created by 1.6 stay valid during the rollout.
	alg: text(),
	crv: text(),
});

export const profileTable = convexTable(
	'profile',
	{
		deletedTime: integer(),
		updatedTime: integer(),
		imageKey: text(),
		imageUrl: text(),
		bio: text(),
		location: text(),
		locale: textEnum(APP_LOCALES),
		personalOrganizationId: text().references(() => organizationTable.id),
		urls: urlField,
		userId: text()
			.notNull()
			.references(() => userTable.id),
		username: text().notNull(),
		email: text().notNull(),
		role: textEnum(PROFILE_ROLES).notNull(),
		name: text().notNull(),
	},
	(table) => [index('by_username').on(table.username), index('by_userId').on(table.userId)]
);

export const projectTable = convexTable(
	'project',
	{
		deletedTime: integer(),
		updatedTime: integer(),
		orgSlug: text().notNull(),
		name: text().notNull(),
		description: text(),
		urls: projectUrlField,
		visibility: textEnum(PROJECT_VISIBILITIES).notNull(),
		logoUrl: text(),
		slug: text().notNull(),
	},
	(table) => [
		index('by_orgSlug').on(table.orgSlug),
		index('by_slug').on(table.slug),
		index('by_updatedTime').on(table.updatedTime),
		index('by_orgSlug_slug').on(table.orgSlug, table.slug),
		index('by_orgSlug_visibility_updatedAt').on(table.orgSlug, table.visibility, table.updatedTime),
	]
);

export const projectMemberTable = convexTable(
	'projectMember',
	{
		deletedTime: integer(),
		updatedTime: integer(),
		profileId: id('profile')
			.notNull()
			.references(() => profileTable.id, { onDelete: 'cascade' }),
		projectId: id('project')
			.notNull()
			.references(() => projectTable.id, { onDelete: 'cascade' }),
		// Deprecated compatibility field. New rows omit it; migration removes
		// org-derived rows and unsets `member` before the narrow deploy.
		role: textEnum(PROJECT_MEMBER_ROLES),
		projectVisibility: textEnum(PROJECT_VISIBILITIES).notNull(),
		projectSlug: text().notNull(),
	},
	(table) => [
		index('by_projectId').on(table.projectId),
		index('by_profileId_projectId').on(table.profileId, table.projectId),
		index('by_profileId_projectSlug').on(table.profileId, table.projectSlug),
		index('by_profileId_projectId_role').on(table.profileId, table.projectId, table.role),
		index('by_profileId_projectSlug_role').on(table.profileId, table.projectSlug, table.role),
	]
);

export const projectThemeTable = convexTable(
	'projectTheme',
	{
		projectId: id('project')
			.notNull()
			.references(() => projectTable.id, { onDelete: 'cascade' }),
		version: integer().notNull(),
		// Deprecated compatibility fields. Publishing clears these values.
		presetId: textEnum(STORED_PROJECT_THEME_PRESETS),
		draftLight: json(),
		draftDark: json(),
		draftRevision: integer(),
		draftUpdatedTime: integer(),
		publishedLight: json(),
		publishedDark: json(),
		publishedPresetId: textEnum(STORED_PROJECT_THEME_PRESETS),
		publishedRevision: integer().notNull(),
		publishedTime: integer(),
		publishedByProfileId: id('profile').references(() => profileTable.id, {
			onDelete: 'set null',
		}),
	},
	(table) => [index('by_projectId').on(table.projectId)]
);

export const projectModeratorAccessTable = convexTable(
	'projectModeratorAccess',
	{
		organizationId: text()
			.notNull()
			.references(() => organizationTable.id, { onDelete: 'cascade' }),
		memberId: text()
			.notNull()
			.references(() => memberTable.id, { onDelete: 'cascade' }),
		projectId: id('project')
			.notNull()
			.references(() => projectTable.id, { onDelete: 'cascade' }),
		updatedTime: integer().notNull(),
	},
	(table) => [
		index('by_memberId_and_projectId').on(table.memberId, table.projectId),
		index('by_projectId_and_memberId').on(table.projectId, table.memberId),
		index('by_organizationId_and_memberId').on(table.organizationId, table.memberId),
		index('by_organizationId_and_projectId').on(table.organizationId, table.projectId),
	]
);

export const pendingModeratorProjectAccessTable = convexTable(
	'pendingModeratorProjectAccess',
	{
		invitationId: text()
			.notNull()
			.references(() => invitationTable.id, { onDelete: 'cascade' }),
		organizationId: text()
			.notNull()
			.references(() => organizationTable.id, { onDelete: 'cascade' }),
		projectId: id('project')
			.notNull()
			.references(() => projectTable.id, { onDelete: 'cascade' }),
		updatedTime: integer().notNull(),
	},
	(table) => [
		index('by_invitationId_and_projectId').on(table.invitationId, table.projectId),
		index('by_organizationId_and_projectId').on(table.organizationId, table.projectId),
		// Required by kitcn's project FK cascade; the requested organization
		// composite cannot service a projectId-only incoming-FK lookup.
		index('by_projectId_and_invitationId').on(table.projectId, table.invitationId),
	]
);

export const fileFolderTable = convexTable(
	'fileFolder',
	{
		projectId: id('project')
			.notNull()
			.references(() => projectTable.id, { onDelete: 'cascade' }),
		parentFolderId: id('fileFolder').references((): AnyColumn => fileFolderTable.id, {
			onDelete: 'restrict',
		}),
		name: text().notNull(),
		normalizedName: text().notNull(),
		systemKey: text(),
		createdByProfileId: id('profile').references(() => profileTable.id, {
			onDelete: 'set null',
		}),
		createdTime: integer().notNull(),
		updatedTime: integer().notNull(),
	},
	(table) => [
		index('by_projectId').on(table.projectId),
		index('by_parentFolderId').on(table.parentFolderId),
		index('by_projectId_parentFolderId_normalizedName').on(
			table.projectId,
			table.parentFolderId,
			table.normalizedName
		),
		index('by_projectId_systemKey').on(table.projectId, table.systemKey),
	]
);

export const fileAssetTable = convexTable(
	'fileAsset',
	{
		projectId: id('project')
			.notNull()
			.references(() => projectTable.id, { onDelete: 'cascade' }),
		// Compatibility field: existing assets predate stable public delivery.
		// Only public, project-listed assets receive this value on new writes.
		publicId: text(),
		folderId: id('fileFolder').references(() => fileFolderTable.id, { onDelete: 'set null' }),
		name: text().notNull(),
		normalizedName: text().notNull(),
		extension: text().notNull(),
		category: textEnum(FILE_CATEGORIES).notNull(),
		mimeType: text().notNull(),
		sizeBytes: integer(),
		access: textEnum(FILE_ACCESS_LEVELS).notNull(),
		listing: textEnum(FILE_LISTINGS).notNull(),
		creationMethod: textEnum(FILE_CREATION_METHODS).notNull(),
		originFeature: textEnum(FILE_ORIGIN_FEATURES).notNull(),
		uploaderClass: textEnum(FILE_UPLOADER_CLASSES).notNull(),
		sourceProvider: textEnum(FILE_SOURCE_PROVIDERS).notNull(),
		uploadedByProfileId: id('profile').references(() => profileTable.id, {
			onDelete: 'set null',
		}),
		status: textEnum(FILE_OBJECT_STATUSES).notNull(),
		searchContent: text().notNull(),
		extractedText: text(),
		thumbnailStatus: textEnum(FILE_THUMBNAIL_STATUSES),
		thumbnailObjectKey: text(),
		thumbnailBucketKind: textEnum(FILE_THUMBNAIL_BUCKET_KINDS),
		thumbnailMimeType: text(),
		thumbnailBytes: integer(),
		createdTime: integer().notNull(),
		updatedTime: integer().notNull(),
		deletedTime: integer(),
	},
	(table) => [
		index('by_publicId').on(table.publicId),
		index('by_projectId').on(table.projectId),
		index('by_folderId').on(table.folderId),
		index('by_uploadedByProfileId').on(table.uploadedByProfileId),
		index('by_projectId_status_createdTime').on(table.projectId, table.status, table.createdTime),
		index('by_projectId_status_updatedTime').on(table.projectId, table.status, table.updatedTime),
		index('by_projectId_status_normalizedName').on(
			table.projectId,
			table.status,
			table.normalizedName
		),
		index('by_projectId_listing_status_createdTime').on(
			table.projectId,
			table.listing,
			table.status,
			table.createdTime
		),
		index('by_projectId_listing_status_updatedTime').on(
			table.projectId,
			table.listing,
			table.status,
			table.updatedTime
		),
		index('by_projectId_listing_status_normalizedName').on(
			table.projectId,
			table.listing,
			table.status,
			table.normalizedName
		),
		index('by_projectId_listing_status_sizeBytes').on(
			table.projectId,
			table.listing,
			table.status,
			table.sizeBytes
		),
		index('by_projectId_listing_folderId_status_createdTime').on(
			table.projectId,
			table.listing,
			table.folderId,
			table.status,
			table.createdTime
		),
		index('by_projectId_listing_folderId_status_updatedTime').on(
			table.projectId,
			table.listing,
			table.folderId,
			table.status,
			table.updatedTime
		),
		index('by_projectId_listing_folderId_status_normalizedName').on(
			table.projectId,
			table.listing,
			table.folderId,
			table.status,
			table.normalizedName
		),
		index('by_projectId_listing_folderId_status_sizeBytes').on(
			table.projectId,
			table.listing,
			table.folderId,
			table.status,
			table.sizeBytes
		),
		index('by_projectId_listing_folderId_category_status_createdTime').on(
			table.projectId,
			table.listing,
			table.folderId,
			table.category,
			table.status,
			table.createdTime
		),
		index('by_projectId_listing_folderId_extension_status_createdTime').on(
			table.projectId,
			table.listing,
			table.folderId,
			table.extension,
			table.status,
			table.createdTime
		),
		index('by_projectId_listing_category_status_createdTime').on(
			table.projectId,
			table.listing,
			table.category,
			table.status,
			table.createdTime
		),
		index('by_projectId_listing_extension_status_createdTime').on(
			table.projectId,
			table.listing,
			table.extension,
			table.status,
			table.createdTime
		),
		index('by_projectId_listing_sourceProvider_status_createdTime').on(
			table.projectId,
			table.listing,
			table.sourceProvider,
			table.status,
			table.createdTime
		),
		index('by_projectId_listing_category_sourceProvider_status_createdTime').on(
			table.projectId,
			table.listing,
			table.category,
			table.sourceProvider,
			table.status,
			table.createdTime
		),
		index('by_projectId_listing_extension_sourceProvider_status_createdTime').on(
			table.projectId,
			table.listing,
			table.extension,
			table.sourceProvider,
			table.status,
			table.createdTime
		),
		searchIndex('by_projectId_listing_status_searchContent')
			.on(table.searchContent)
			.filter(
				table.projectId,
				table.listing,
				table.status,
				table.category,
				table.extension,
				table.folderId,
				table.sourceProvider
			),
	]
);

export const fileObjectTable = convexTable(
	'fileObject',
	{
		assetId: id('fileAsset')
			.notNull()
			.references(() => fileAssetTable.id, { onDelete: 'cascade' }),
		projectId: id('project')
			.notNull()
			.references(() => projectTable.id, { onDelete: 'cascade' }),
		orgSlug: text().notNull(),
		storageProvider: textEnum(FILE_STORAGE_PROVIDERS).notNull(),
		bucketKind: textEnum(FILE_BUCKET_KINDS).notNull(),
		objectKey: text().notNull(),
		externalId: text(),
		declaredBytes: integer().notNull(),
		maxBytes: integer(),
		actualBytes: integer(),
		declaredMimeType: text().notNull(),
		actualMimeType: text(),
		status: textEnum(FILE_OBJECT_STATUSES).notNull(),
		expiresAt: integer(),
		readyTime: integer(),
		deletedTime: integer(),
		createdTime: integer().notNull(),
		updatedTime: integer().notNull(),
	},
	(table) => [
		index('by_assetId').on(table.assetId),
		index('by_projectId').on(table.projectId),
		index('by_projectId_status_createdTime').on(table.projectId, table.status, table.createdTime),
		index('by_objectKey').on(table.objectKey),
		index('by_status_expiresAt').on(table.status, table.expiresAt),
	]
);

export const fileReferenceTable = convexTable(
	'fileReference',
	{
		assetId: id('fileAsset')
			.notNull()
			.references(() => fileAssetTable.id, { onDelete: 'cascade' }),
		projectId: id('project')
			.notNull()
			.references(() => projectTable.id, { onDelete: 'cascade' }),
		feature: textEnum(FILE_ORIGIN_FEATURES).notNull(),
		entityType: text().notNull(),
		entityId: text().notNull(),
		field: text().notNull(),
		createdTime: integer().notNull(),
	},
	(table) => [
		index('by_assetId').on(table.assetId),
		index('by_projectId').on(table.projectId),
		index('by_projectId_feature').on(table.projectId, table.feature),
		index('by_feature_entityType_entityId_field').on(
			table.feature,
			table.entityType,
			table.entityId,
			table.field
		),
	]
);

export const projectStorageUsageTable = convexTable(
	'projectStorageUsage',
	{
		projectId: id('project')
			.notNull()
			.references(() => projectTable.id, { onDelete: 'cascade' }),
		orgSlug: text().notNull(),
		usedBytes: integer().notNull(),
		reservedBytes: integer().notNull(),
		fileCount: integer().notNull(),
		byCategory: json().notNull(),
		byOrigin: json().notNull(),
		byUploaderClass: json().notNull(),
		updatedTime: integer().notNull(),
	},
	(table) => [index('by_projectId').on(table.projectId), index('by_orgSlug').on(table.orgSlug)]
);

export const orgStorageUsageTable = convexTable(
	'orgStorageUsage',
	{
		deletedTime: integer(),
		updatedTime: integer(),
		orgSlug: text().notNull(),
		totalBytes: integer().notNull(),
		fileCount: integer().notNull(),
	},
	(table) => [index('by_orgSlug').on(table.orgSlug)]
);

export const feedbackBoardTable = convexTable(
	'feedbackBoard',
	{
		deletedTime: integer(),
		updatedTime: integer(),
		name: text().notNull(),
		projectId: id('project')
			.notNull()
			.references(() => projectTable.id, { onDelete: 'cascade' }),
		description: text(),
		icon: text(),
		slug: text().notNull(),
	},
	(table) => [
		index('by_projectId').on(table.projectId),
		index('by_slug_projectId').on(table.slug, table.projectId),
	]
);

export const feedbackCommentTable = convexTable(
	'feedbackComment',
	{
		deletedTime: integer(),
		updatedTime: integer(),
		feedbackId: id('feedback')
			.notNull()
			.references(() => feedbackTable.id, { onDelete: 'cascade' }),
		authorProfileId: id('profile')
			.notNull()
			.references(() => profileTable.id),
		// Self-referential pointer to a parent comment. `id()` is an implicit FK in
		// kitcn, so it needs an explicit onDelete action + an index for cascade
		// enforcement; a deleted parent comment nulls the reply pointer.
		replyFeedbackCommentId: id('feedbackComment').references(
			(): AnyColumn => feedbackCommentTable.id,
			{ onDelete: 'set null' }
		),
		content: text().notNull(),
		initial: boolean(),
	},
	(table) => [
		index('by_feedbackId').on(table.feedbackId),
		index('by_authorProfileId').on(table.authorProfileId),
		index('by_replyFeedbackCommentId').on(table.replyFeedbackCommentId),
	]
);

export const feedbackTable = convexTable(
	'feedback',
	{
		updatedTime: integer(),
		slug: text().notNull(),
		title: text().notNull(),
		authorProfileId: id('profile')
			.notNull()
			.references(() => profileTable.id),
		projectId: id('project')
			.notNull()
			.references(() => projectTable.id),
		upvotes: integer().notNull(),
		boardId: id('feedbackBoard')
			.notNull()
			.references(() => feedbackBoardTable.id, { onDelete: 'cascade' }),
		// Pointers to comments. `id()` is an implicit FK in kitcn, so each needs an
		// explicit onDelete action + index: deleting a referenced comment nulls the
		// pointer rather than blocking the delete.
		firstCommentId: id('feedbackComment').references((): AnyColumn => feedbackCommentTable.id, {
			onDelete: 'set null',
		}),
		answerCommentId: id('feedbackComment').references((): AnyColumn => feedbackCommentTable.id, {
			onDelete: 'set null',
		}),
		assignedProfileId: id('profile').references(() => profileTable.id, {
			onDelete: 'set null',
		}),
		status: textEnum(FEEDBACK_STATUSES).notNull(),
		// Nullable: existing rows have no priority (read as 'none'); moderators set it
		// explicitly. Will gain a `by_projectId_priority` (staged) index when priority
		// filtering lands elsewhere.
		priority: textEnum(FEEDBACK_PRIORITIES),
		target: text(),
		targetGranularity: textEnum(targetGranularities),
		tags: arrayOf(text().notNull()),
		searchContent: text(),
	},
	(table) => [
		index('by_slug').on(table.slug),
		index('by_projectId').on(table.projectId),
		// Indexes required so kitcn can enforce the implicit-FK onDelete actions on
		// these pointer/assignment columns during cascade deletes.
		index('by_firstCommentId').on(table.firstCommentId),
		index('by_answerCommentId').on(table.answerCommentId),
		index('by_assignedProfileId').on(table.assignedProfileId),
		// Standalone leading-field index on boardId so the feedbackBoard→feedback
		// cascade can resolve referencing rows (composite indexes don't qualify).
		index('by_boardId').on(table.boardId),
		index('by_projectId_slug').on(table.projectId, table.slug),
		index('by_projectId_boardId').on(table.projectId, table.boardId),
		index('by_projectId_status').on(table.projectId, table.status),
		index('by_projectId_boardId_status').on(table.projectId, table.boardId, table.status),
		searchIndex('by_projectId_boardId_status_searchContent')
			.on(table.searchContent)
			.filter(table.projectId, table.boardId, table.status),
	]
);

export const feedbackCommentEmoteTable = convexTable(
	'feedbackCommentEmote',
	{
		deletedTime: integer(),
		updatedTime: integer(),
		authorProfileId: id('profile')
			.notNull()
			.references(() => profileTable.id),
		feedbackId: id('feedback')
			.notNull()
			.references(() => feedbackTable.id, { onDelete: 'cascade' }),
		feedbackCommentId: id('feedbackComment')
			.notNull()
			.references(() => feedbackCommentTable.id, { onDelete: 'cascade' }),
		content: textEnum(EMOTE_CONTENTS).notNull(),
	},
	(table) => [
		index('by_authorProfileId').on(table.authorProfileId),
		index('by_feedbackId').on(table.feedbackId),
		index('by_feedbackCommentId').on(table.feedbackCommentId),
		index('by_feedbackCommentId_authorProfileId_content').on(
			table.feedbackCommentId,
			table.authorProfileId,
			table.content
		),
	]
);

export const feedbackEventTable = convexTable(
	'feedbackEvent',
	{
		deletedTime: integer(),
		updatedTime: integer(),
		feedbackId: id('feedback')
			.notNull()
			.references(() => feedbackTable.id, { onDelete: 'cascade' }),
		actorProfileId: id('profile')
			.notNull()
			.references(() => profileTable.id),
		eventType: textEnum(FEEDBACK_EVENT_TYPES).notNull(),
		metadata: json(),
	},
	(table) => [index('by_feedbackId').on(table.feedbackId)]
);

export const feedbackUpvoteTable = convexTable(
	'feedbackUpvote',
	{
		deletedTime: integer(),
		updatedTime: integer(),
		feedbackId: id('feedback')
			.notNull()
			.references(() => feedbackTable.id, { onDelete: 'cascade' }),
		authorProfileId: id('profile')
			.notNull()
			.references(() => profileTable.id),
	},
	(table) => [
		index('by_feedbackId').on(table.feedbackId),
		index('by_feedbackId_authorProfileId').on(table.feedbackId, table.authorProfileId),
	]
);

export const updateTable = convexTable(
	'update',
	{
		deletedTime: integer(),
		updatedTime: integer().notNull(),
		slug: text().notNull(),
		title: text().notNull(),
		content: text().notNull(),
		authorProfileId: id('profile')
			.notNull()
			.references(() => profileTable.id),
		projectId: id('project')
			.notNull()
			.references(() => projectTable.id, { onDelete: 'cascade' }),
		status: textEnum(UPDATE_STATUSES).notNull(),
		publishedAt: integer(),
		category: textEnum(UPDATE_CATEGORIES).notNull(),
		tags: arrayOf(text().notNull()),
		relatedFeedbackIds: arrayOf(id('feedback').notNull()),
		coverImageId: text(),
		authorAsOrg: boolean(),
	},
	(table) => [
		index('by_projectId_slug').on(table.projectId, table.slug),
		index('by_projectId_updatedTime').on(table.projectId, table.updatedTime),
		index('by_projectId_status_publishedAt').on(table.projectId, table.status, table.publishedAt),
		// Supports the public updates list when filtered by category. Ordered so a
		// category-scoped read can still page by publishedAt (visitor, published
		// only) or by status then publishedAt (content manager, all statuses).
		index('by_projectId_category_status_publishedAt').on(
			table.projectId,
			table.category,
			table.status,
			table.publishedAt
		),
	]
);

export const updateCommentTable = convexTable(
	'updateComment',
	{
		deletedTime: integer(),
		updatedTime: integer(),
		updateId: id('update')
			.notNull()
			.references(() => updateTable.id, { onDelete: 'cascade' }),
		authorProfileId: id('profile')
			.notNull()
			.references(() => profileTable.id),
		content: text().notNull(),
	},
	(table) => [
		// aggregateIndex keeps an exact count in a hidden aggregate_bucket row, maintained by
		// an implicit ORM change-trigger in the SAME mutation as each write. Writes to this table
		// MUST go through ctx.orm (insert/delete) so the trigger fires — a raw ctx.db write would
		// silently drift the count. See docs/reactions-aggregate.md.
		aggregateIndex('by_updateId').on(table.updateId).count(table.updateId),
		index('by_updateId').on(table.updateId),
		index('by_authorProfileId').on(table.authorProfileId),
	]
);

export const updateEmoteTable = convexTable(
	'updateEmote',
	{
		deletedTime: integer(),
		updatedTime: integer(),
		updateId: id('update')
			.notNull()
			.references(() => updateTable.id, { onDelete: 'cascade' }),
		authorProfileId: id('profile')
			.notNull()
			.references(() => profileTable.id),
		content: textEnum(EMOTE_CONTENTS).notNull(),
	},
	(table) => [
		// aggregateIndex keeps an exact per-(updateId, content) count in a hidden aggregate_bucket
		// row, maintained by an implicit ORM change-trigger in the SAME mutation as each write.
		// Writes to this table MUST go through ctx.orm (insert/delete) so the trigger fires — a raw
		// ctx.db write would silently drift the count. Note: the bucket is a single unsharded row per
		// key, so concurrent toggles on the same (updateId, content) contend on one row (hot-key OCC).
		// See docs/reactions-aggregate.md.
		aggregateIndex('by_updateId_content').on(table.updateId, table.content).count(table.updateId),
		index('by_updateId').on(table.updateId),
		index('by_updateId_authorProfileId_content').on(
			table.updateId,
			table.authorProfileId,
			table.content
		),
	]
);

export const updateCommentEmoteTable = convexTable(
	'updateCommentEmote',
	{
		deletedTime: integer(),
		updatedTime: integer(),
		updateId: id('update')
			.notNull()
			.references(() => updateTable.id, { onDelete: 'cascade' }),
		updateCommentId: id('updateComment')
			.notNull()
			.references(() => updateCommentTable.id, { onDelete: 'cascade' }),
		authorProfileId: id('profile')
			.notNull()
			.references(() => profileTable.id),
		content: textEnum(EMOTE_CONTENTS).notNull(),
	},
	(table) => [
		index('by_updateCommentId').on(table.updateCommentId),
		index('by_updateId').on(table.updateId),
		index('by_updateCommentId_authorProfileId_content').on(
			table.updateCommentId,
			table.authorProfileId,
			table.content
		),
	]
);

export const githubConnectionStateTable = convexTable(
	'githubConnectionState',
	{
		deletedTime: integer(),
		updatedTime: integer(),
		createdByProfileId: id('profile')
			.notNull()
			.references(() => profileTable.id),
		createdByUserId: text()
			.notNull()
			.references(() => userTable.id),
		expiresAt: integer().notNull(),
		mode: textEnum(GITHUB_SYNC_MODES).notNull(),
		orgId: text()
			.notNull()
			.references(() => organizationTable.id),
		orgSlug: text().notNull(),
		projectId: id('project').references(() => projectTable.id, {
			onDelete: 'cascade',
		}),
		projectSlug: text(),
		stateHash: text().notNull(),
		status: textEnum(GITHUB_CONNECTION_STATE_STATUSES).notNull(),
		consumedAt: integer(),
	},
	(table) => [
		index('by_stateHash').on(table.stateHash),
		index('by_orgId').on(table.orgId),
		index('by_projectId').on(table.projectId),
		index('by_expiresAt').on(table.expiresAt),
	]
);

export const githubInstallationTable = convexTable(
	'githubInstallation',
	{
		deletedTime: integer(),
		updatedTime: integer(),
		accountId: integer().notNull(),
		accountLogin: text().notNull(),
		accountType: text().notNull(),
		connectedByProfileId: id('profile')
			.notNull()
			.references(() => profileTable.id),
		events: arrayOf(text().notNull()),
		installationId: integer().notNull(),
		orgId: text()
			.notNull()
			.references(() => organizationTable.id, { onDelete: 'cascade' }),
		orgSlug: text().notNull(),
		permissions: json(),
		repositorySelection: text().notNull(),
		status: textEnum(GITHUB_INSTALLATION_STATUSES).notNull(),
	},
	(table) => [
		index('by_installationId').on(table.installationId),
		index('by_orgId').on(table.orgId),
		index('by_orgId_installationId').on(table.orgId, table.installationId),
	]
);

export const githubRepositoryConnectionTable = convexTable(
	'githubRepositoryConnection',
	{
		deletedTime: integer(),
		updatedTime: integer(),
		connectedByProfileId: id('profile')
			.notNull()
			.references(() => profileTable.id),
		enabledSources: arrayOf(text().notNull()),
		githubInstallationId: id('githubInstallation')
			.notNull()
			.references(() => githubInstallationTable.id, { onDelete: 'cascade' }),
		issuesVerifiedAt: integer(),
		discussionsVerifiedAt: integer(),
		mode: textEnum(GITHUB_SYNC_MODES).notNull(),
		orgId: text()
			.notNull()
			.references(() => organizationTable.id),
		orgSlug: text().notNull(),
		projectId: id('project')
			.notNull()
			.references(() => projectTable.id, { onDelete: 'cascade' }),
		projectSlug: text().notNull(),
		repoFullName: text().notNull(),
		repoId: integer().notNull(),
		repoName: text().notNull(),
		repoNodeId: text().notNull(),
		repoOwner: text().notNull(),
		repoPrivate: boolean(),
		verificationStatus: text().notNull(),
		verificationSummary: json(),
	},
	(table) => [
		index('by_projectId').on(table.projectId),
		index('by_orgId_repoId').on(table.orgId, table.repoId),
		index('by_githubInstallationId').on(table.githubInstallationId),
		index('by_repoId').on(table.repoId),
	]
);

export const feedbackGithubConnectionTable = convexTable(
	'feedbackGithubConnection',
	{
		deletedTime: integer(),
		updatedTime: integer(),
		connectedByProfileId: id('profile')
			.notNull()
			.references(() => profileTable.id),
		feedbackId: id('feedback')
			.notNull()
			.references(() => feedbackTable.id, { onDelete: 'cascade' }),
		githubRepositoryConnectionId: id('githubRepositoryConnection')
			.notNull()
			.references(() => githubRepositoryConnectionTable.id, {
				onDelete: 'cascade',
			}),
		projectId: id('project')
			.notNull()
			.references(() => projectTable.id),
		kind: textEnum(FEEDBACK_GITHUB_CONNECTION_KINDS).notNull(),
		githubDatabaseId: integer(),
		githubNodeId: text().notNull(),
		githubNumber: integer().notNull(),
		title: text().notNull(),
		url: text().notNull(),
		state: text().notNull(),
	},
	(table) => [
		index('by_feedbackId').on(table.feedbackId),
		index('by_projectId').on(table.projectId),
		index('by_githubRepositoryConnectionId').on(table.githubRepositoryConnectionId),
		index('by_githubRepositoryConnectionId_githubNodeId').on(
			table.githubRepositoryConnectionId,
			table.githubNodeId
		),
		index('by_feedbackId_kind_githubNodeId').on(table.feedbackId, table.kind, table.githubNodeId),
	]
);

export const githubWebhookDeliveryTable = convexTable(
	'githubWebhookDelivery',
	{
		action: text(),
		deliveryId: text().notNull(),
		event: text().notNull(),
		installationId: integer(),
		receivedTime: integer().notNull(),
		result: textEnum(['processed', 'ignored'] as const).notNull(),
	},
	(table) => [
		index('by_deliveryId').on(table.deliveryId),
		index('by_receivedTime').on(table.receivedTime),
	]
);

export const tables = {
	user: userTable,
	session: sessionTable,
	account: accountTable,
	verification: verificationTable,
	organization: organizationTable,
	member: memberTable,
	invitation: invitationTable,
	jwks: jwksTable,
	profile: profileTable,
	project: projectTable,
	projectMember: projectMemberTable,
	projectModeratorAccess: projectModeratorAccessTable,
	pendingModeratorProjectAccess: pendingModeratorProjectAccessTable,
	projectTheme: projectThemeTable,
	fileFolder: fileFolderTable,
	fileAsset: fileAssetTable,
	fileObject: fileObjectTable,
	fileReference: fileReferenceTable,
	projectStorageUsage: projectStorageUsageTable,
	orgStorageUsage: orgStorageUsageTable,
	feedback: feedbackTable,
	feedbackBoard: feedbackBoardTable,
	feedbackComment: feedbackCommentTable,
	feedbackCommentEmote: feedbackCommentEmoteTable,
	feedbackEvent: feedbackEventTable,
	feedbackUpvote: feedbackUpvoteTable,
	update: updateTable,
	updateComment: updateCommentTable,
	updateEmote: updateEmoteTable,
	updateCommentEmote: updateCommentEmoteTable,
	githubConnectionState: githubConnectionStateTable,
	githubInstallation: githubInstallationTable,
	githubRepositoryConnection: githubRepositoryConnectionTable,
	feedbackGithubConnection: feedbackGithubConnectionTable,
	githubWebhookDelivery: githubWebhookDeliveryTable,
};

export default defineSchema(tables)
	.relations((r) => ({
		user: {
			profile: r.one.profile({
				from: r.user.profileId,
				to: r.profile.id,
			}),
			sessions: r.many.session({
				from: r.user.id,
				to: r.session.userId,
			}),
			accounts: r.many.account({
				from: r.user.id,
				to: r.account.userId,
			}),
			memberships: r.many.member({
				from: r.user.id,
				to: r.member.userId,
			}),
		},
		session: {
			user: r.one.user({
				from: r.session.userId,
				to: r.user.id,
			}),
			activeOrganization: r.one.organization({
				from: r.session.activeOrganizationId,
				to: r.organization.id,
			}),
		},
		account: {
			user: r.one.user({
				from: r.account.userId,
				to: r.user.id,
			}),
		},
		organization: {
			members: r.many.member({
				from: r.organization.id,
				to: r.member.organizationId,
			}),
			invitations: r.many.invitation({
				from: r.organization.id,
				to: r.invitation.organizationId,
			}),
			moderatorProjectAccess: r.many.projectModeratorAccess({
				from: r.organization.id,
				to: r.projectModeratorAccess.organizationId,
			}),
			githubInstallations: r.many.githubInstallation({
				from: r.organization.id,
				to: r.githubInstallation.orgId,
			}),
			githubRepositoryConnections: r.many.githubRepositoryConnection({
				from: r.organization.id,
				to: r.githubRepositoryConnection.orgId,
			}),
		},
		member: {
			organization: r.one.organization({
				from: r.member.organizationId,
				to: r.organization.id,
			}),
			user: r.one.user({
				from: r.member.userId,
				to: r.user.id,
			}),
			projectAccess: r.many.projectModeratorAccess({
				from: r.member.id,
				to: r.projectModeratorAccess.memberId,
			}),
		},
		invitation: {
			organization: r.one.organization({
				from: r.invitation.organizationId,
				to: r.organization.id,
			}),
			inviter: r.one.user({
				from: r.invitation.inviterId,
				to: r.user.id,
			}),
			pendingProjectAccess: r.many.pendingModeratorProjectAccess({
				from: r.invitation.id,
				to: r.pendingModeratorProjectAccess.invitationId,
			}),
		},
		profile: {
			user: r.one.user({
				from: r.profile.userId,
				to: r.user.id,
			}),
			personalOrganization: r.one.organization({
				from: r.profile.personalOrganizationId,
				to: r.organization.id,
			}),
			projectMemberships: r.many.projectMember({
				from: r.profile.id,
				to: r.projectMember.profileId,
			}),
			feedbackGithubConnections: r.many.feedbackGithubConnection({
				from: r.profile.id,
				to: r.feedbackGithubConnection.connectedByProfileId,
			}),
		},
		project: {
			memberships: r.many.projectMember({
				from: r.project.id,
				to: r.projectMember.projectId,
			}),
			moderatorAccess: r.many.projectModeratorAccess({
				from: r.project.id,
				to: r.projectModeratorAccess.projectId,
			}),
			pendingModeratorAccess: r.many.pendingModeratorProjectAccess({
				from: r.project.id,
				to: r.pendingModeratorProjectAccess.projectId,
			}),
			githubRepositoryConnections: r.many.githubRepositoryConnection({
				from: r.project.id,
				to: r.githubRepositoryConnection.projectId,
			}),
			feedbackGithubConnections: r.many.feedbackGithubConnection({
				from: r.project.id,
				to: r.feedbackGithubConnection.projectId,
			}),
		},
		projectTheme: {
			project: r.one.project({
				from: r.projectTheme.projectId,
				to: r.project.id,
			}),
			publishedBy: r.one.profile({
				from: r.projectTheme.publishedByProfileId,
				to: r.profile.id,
			}),
		},
		projectMember: {
			profile: r.one.profile({
				from: r.projectMember.profileId,
				to: r.profile.id,
			}),
			project: r.one.project({
				from: r.projectMember.projectId,
				to: r.project.id,
			}),
		},
		projectModeratorAccess: {
			member: r.one.member({
				from: r.projectModeratorAccess.memberId,
				to: r.member.id,
			}),
			organization: r.one.organization({
				from: r.projectModeratorAccess.organizationId,
				to: r.organization.id,
			}),
			project: r.one.project({
				from: r.projectModeratorAccess.projectId,
				to: r.project.id,
			}),
		},
		pendingModeratorProjectAccess: {
			invitation: r.one.invitation({
				from: r.pendingModeratorProjectAccess.invitationId,
				to: r.invitation.id,
			}),
			organization: r.one.organization({
				from: r.pendingModeratorProjectAccess.organizationId,
				to: r.organization.id,
			}),
			project: r.one.project({
				from: r.pendingModeratorProjectAccess.projectId,
				to: r.project.id,
			}),
		},
		githubConnectionState: {
			creator: r.one.profile({
				from: r.githubConnectionState.createdByProfileId,
				to: r.profile.id,
			}),
			organization: r.one.organization({
				from: r.githubConnectionState.orgId,
				to: r.organization.id,
			}),
			project: r.one.project({
				from: r.githubConnectionState.projectId,
				to: r.project.id,
			}),
		},
		githubInstallation: {
			connectedBy: r.one.profile({
				from: r.githubInstallation.connectedByProfileId,
				to: r.profile.id,
			}),
			organization: r.one.organization({
				from: r.githubInstallation.orgId,
				to: r.organization.id,
			}),
			repositoryConnections: r.many.githubRepositoryConnection({
				from: r.githubInstallation.id,
				to: r.githubRepositoryConnection.githubInstallationId,
			}),
		},
		githubRepositoryConnection: {
			connectedBy: r.one.profile({
				from: r.githubRepositoryConnection.connectedByProfileId,
				to: r.profile.id,
			}),
			githubInstallation: r.one.githubInstallation({
				from: r.githubRepositoryConnection.githubInstallationId,
				to: r.githubInstallation.id,
			}),
			organization: r.one.organization({
				from: r.githubRepositoryConnection.orgId,
				to: r.organization.id,
			}),
			project: r.one.project({
				from: r.githubRepositoryConnection.projectId,
				to: r.project.id,
			}),
			feedbackGithubConnections: r.many.feedbackGithubConnection({
				from: r.githubRepositoryConnection.id,
				to: r.feedbackGithubConnection.githubRepositoryConnectionId,
			}),
		},
		feedbackGithubConnection: {
			connectedBy: r.one.profile({
				from: r.feedbackGithubConnection.connectedByProfileId,
				to: r.profile.id,
			}),
			feedback: r.one.feedback({
				from: r.feedbackGithubConnection.feedbackId,
				to: r.feedback.id,
			}),
			githubRepositoryConnection: r.one.githubRepositoryConnection({
				from: r.feedbackGithubConnection.githubRepositoryConnectionId,
				to: r.githubRepositoryConnection.id,
			}),
			project: r.one.project({
				from: r.feedbackGithubConnection.projectId,
				to: r.project.id,
			}),
		},
	}))
	.triggers({
		invitation: {
			change: async (change, ctx) => {
				if (change.operation === 'delete') {
					await deletePendingModeratorAccessForInvitation(ctx, change.oldDoc.id);
					return;
				}
				if (change.newDoc.status !== 'pending') {
					await deletePendingModeratorAccessForInvitation(ctx, change.newDoc.id);
				}
			},
		},
		member: {
			change: async (change, ctx) => {
				if (change.operation === 'delete') {
					await deleteModeratorAccessForMember(ctx, change.oldDoc.id);
					return;
				}

				if (change.newDoc.role !== 'moderator') {
					await deleteModeratorAccessForMember(ctx, change.newDoc.id);
				}
			},
		},
		project: {
			change: async (change, ctx) => {
				if (change.operation === 'insert') {
					const boards = ['Bugs', 'Feature Requests', 'Improvements'] as const;
					await Promise.all(
						boards.map((name) =>
							ctx.orm.insert(feedbackBoardTable).values({
								icon:
									name === 'Bugs' ? 'bug' : name === 'Improvements' ? 'improvements' : 'lightbulb',
								name,
								projectId: change.newDoc.id as any,
								slug: normalizeSlug(name, VALIDATION_LIMITS.projectSlug),
							})
						)
					);
					return;
				}

				if (change.operation === 'update') {
					const [memberships, connectionStates, repoConnections] = await Promise.all([
						ctx.db
							.query('projectMember')
							.withIndex('by_projectId', (q: any) => q.eq('projectId', change.newDoc.id))
							.collect(),
						ctx.db
							.query('githubConnectionState')
							.withIndex('by_projectId', (q: any) => q.eq('projectId', change.newDoc.id))
							.collect(),
						ctx.db
							.query('githubRepositoryConnection')
							.withIndex('by_projectId', (q: any) => q.eq('projectId', change.newDoc.id))
							.collect(),
					]);
					const now = Date.now();

					await Promise.all([
						...memberships.map((membership: any) =>
							ctx.db.patch('projectMember', membership._id, {
								projectSlug: change.newDoc.slug,
								projectVisibility: change.newDoc.visibility,
							})
						),
						...connectionStates.map((state: any) =>
							ctx.db.patch('githubConnectionState', state._id, {
								projectSlug: change.newDoc.slug,
								updatedTime: now,
							})
						),
						...repoConnections.map((connection: any) =>
							ctx.db.patch('githubRepositoryConnection', connection._id, {
								projectSlug: change.newDoc.slug,
								updatedTime: now,
							})
						),
					]);
					return;
				}

				// Hard-deleting a project is not an app path today. If one is added it
				// MUST go through ctx.orm.delete(projectTable) so the FK cascades
				// (feedbackBoard / projectMember / githubConnectionState /
				// githubRepositoryConnection / update → project, and onward to feedback
				// via feedbackBoard) clean up children. A raw ctx.db.delete bypasses
				// referential actions and would orphan rows.
			},
		},
		// NOTE: feedbackBoard / feedback / updateComment / update no longer need
		// delete triggers — child cleanup is handled declaratively by the
		// `onDelete: "cascade"` foreign keys, which fire on ctx.orm.delete(...).
		// Only non-cascade business logic remains as triggers below.
		feedbackComment: {
			change: async (change, ctx) => {
				// Deleting a comment is handled declaratively: its emotes cascade away
				// (FK), and any feedback.answerCommentId / firstCommentId (and reply
				// pointers) are nulled (FK set null). Only the initial-comment search
				// denormalization needs a trigger.
				if (change.operation === 'update' && change.newDoc.initial) {
					const feedback = await ctx.db.get('feedback', change.newDoc.feedbackId);
					if (feedback) {
						await ctx.db.patch('feedback', feedback._id, {
							searchContent: `${feedback.title} ${change.newDoc.content}`,
							updatedTime: Date.now(),
						});
					}
				}
			},
		},
	});
