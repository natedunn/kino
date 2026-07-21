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
import { targetGranularities } from '../shared/target';

const PROFILE_ROLES = ['system:admin', 'system:editor', 'user'] as const;
const PROJECT_VISIBILITIES = ['public', 'private', 'archived'] as const;
// Project membership is purely DERIVED from org membership (see
// ORG_ROLE_TO_PROJECT_ROLE). owner/admin -> org:admin, editor -> org:editor,
// member -> member. The old direct "admin"/"editor" values were never written
// by any code path and have been removed (verified: no rows used them).
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
const GITHUB_INSTALLATION_STATUSES = ['active', 'suspended', 'deleted'] as const;
const FEEDBACK_GITHUB_CONNECTION_KINDS = ['issue'] as const;
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

// Org roles are owner/admin/editor only (no plain org "member"). They cascade
// to projects as org:admin/org:editor. The project "member" role is NEVER
// produced here — it is exclusively a DIRECT per-project grant (see
// projectMember.inviteProjectMember), so org-derived and direct rows can't be
// conflated.
const ORG_ROLE_TO_PROJECT_ROLE = {
	owner: 'org:admin',
	admin: 'org:admin',
	editor: 'org:editor',
} as const;

type SupportedOrgRole = keyof typeof ORG_ROLE_TO_PROJECT_ROLE;

function isSupportedOrgRole(role: string | null | undefined): role is SupportedOrgRole {
	return role === 'owner' || role === 'admin' || role === 'editor';
}

// The `.collect()`s in this file's sync helpers are intentionally unbounded:
// every query is scoped to a single organization (its projects) or a single
// (profile, project) pair, so the result set is bounded by one org's size and
// must be processed in full to keep `projectMember` rows consistent. A `.take()`
// would silently skip memberships and leave them stale/orphaned.
async function syncProjectMembershipsForOrgMember(
	ctx: any,
	args: {
		organizationId: string;
		role: string | null | undefined;
		userId: string;
	}
) {
	const [organization, profile] = await Promise.all([
		ctx.db.get('organization', args.organizationId),
		ctx.db
			.query('profile')
			.withIndex('by_userId', (q: any) => q.eq('userId', args.userId))
			.unique(),
	]);

	if (!organization || !profile) {
		return;
	}

	if (!isSupportedOrgRole(args.role)) {
		const orgProjects = await ctx.db
			.query('project')
			.withIndex('by_orgSlug', (q: any) => q.eq('orgSlug', organization.slug))
			.collect();

		const projectMemberships = await Promise.all(
			orgProjects.map((project: any) =>
				ctx.db
					.query('projectMember')
					.withIndex('by_profileId_projectId', (q: any) =>
						q.eq('profileId', profile._id).eq('projectId', project._id)
					)
					.collect()
			)
		);

		await Promise.all(
			projectMemberships
				.flat()
				.map((membership: any) => ctx.db.delete('projectMember', membership._id))
		);
		return;
	}

	const projectRole = ORG_ROLE_TO_PROJECT_ROLE[args.role];
	const projects = await ctx.db
		.query('project')
		.withIndex('by_orgSlug', (q: any) => q.eq('orgSlug', organization.slug))
		.collect();

	await Promise.all(
		projects.map(async (project: any) => {
			const memberships = await ctx.db
				.query('projectMember')
				.withIndex('by_profileId_projectId', (q: any) =>
					q.eq('profileId', profile._id).eq('projectId', project._id)
				)
				.collect();

			if (memberships.length > 0) {
				await ctx.db.patch('projectMember', memberships[0]._id, {
					projectSlug: project.slug,
					projectVisibility: project.visibility,
					role: projectRole,
					updatedTime: Date.now(),
				});
				await Promise.all(
					memberships
						.slice(1)
						.map((membership: any) => ctx.db.delete('projectMember', membership._id))
				);
				return;
			}

			await ctx.orm.insert(projectMemberTable).values({
				profileId: profile._id,
				projectId: project._id,
				projectSlug: project.slug,
				projectVisibility: project.visibility,
				role: projectRole,
			});
		})
	);
}

async function syncProjectMembershipsForProject(
	ctx: any,
	project: {
		_id: string;
		orgSlug: string;
		slug: string;
		visibility: (typeof PROJECT_VISIBILITIES)[number];
	}
) {
	const organization = await ctx.db
		.query('organization')
		.withIndex('slug', (q: any) => q.eq('slug', project.orgSlug))
		.unique();

	if (!organization) {
		return;
	}

	const members = await ctx.db
		.query('member')
		.withIndex('organizationId', (q: any) => q.eq('organizationId', organization._id))
		.collect();

	await Promise.all(
		members.map(async (member: any) => {
			if (!isSupportedOrgRole(member.role)) {
				return;
			}

			const profile = await ctx.db
				.query('profile')
				.withIndex('by_userId', (q: any) => q.eq('userId', member.userId))
				.unique();

			if (!profile) {
				return;
			}

			const existingMemberships = await ctx.db
				.query('projectMember')
				.withIndex('by_profileId_projectId', (q: any) =>
					q.eq('profileId', profile._id).eq('projectId', project._id)
				)
				.collect();

			const role = ORG_ROLE_TO_PROJECT_ROLE[member.role as SupportedOrgRole];

			if (existingMemberships.length > 0) {
				await ctx.db.patch('projectMember', existingMemberships[0]._id, {
					projectSlug: project.slug,
					projectVisibility: project.visibility,
					role,
					updatedTime: Date.now(),
				});
				await Promise.all(
					existingMemberships
						.slice(1)
						.map((membership: any) => ctx.db.delete('projectMember', membership._id))
				);
				return;
			}

			await ctx.orm.insert(projectMemberTable).values({
				profileId: profile._id,
				projectId: project._id,
				projectSlug: project.slug,
				projectVisibility: project.visibility,
				role,
			});
		})
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
		role: textEnum(PROJECT_MEMBER_ROLES).notNull(),
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
		// Nullable: existing rows have no priority (read as 'none'); editors set it
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
		// category-scoped read can still page by publishedAt (non-editor, published
		// only) or by status then publishedAt (editor, all statuses).
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
			githubRepositoryConnections: r.many.githubRepositoryConnection({
				from: r.project.id,
				to: r.githubRepositoryConnection.projectId,
			}),
			feedbackGithubConnections: r.many.feedbackGithubConnection({
				from: r.project.id,
				to: r.feedbackGithubConnection.projectId,
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
		member: {
			change: async (change, ctx) => {
				if (change.operation === 'delete') {
					await syncProjectMembershipsForOrgMember(ctx, {
						organizationId: change.oldDoc.organizationId,
						role: null,
						userId: change.oldDoc.userId,
					});
					return;
				}

				await syncProjectMembershipsForOrgMember(ctx, {
					organizationId: change.newDoc.organizationId,
					role: change.newDoc.role,
					userId: change.newDoc.userId,
				});
			},
		},
		project: {
			change: async (change, ctx) => {
				if (change.operation === 'insert') {
					await syncProjectMembershipsForProject(ctx, {
						_id: change.newDoc.id,
						orgSlug: change.newDoc.orgSlug,
						slug: change.newDoc.slug,
						visibility: change.newDoc.visibility,
					});

					const boards = ['Bugs', 'Feature Requests', 'Improvements'] as const;
					await Promise.all(
						boards.map((name) =>
							ctx.orm.insert(feedbackBoardTable).values({
								icon: name === 'Bugs' ? 'bug' : name === 'Improvements' ? 'chartUp' : 'lightbulb',
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
