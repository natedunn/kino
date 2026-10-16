import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

import { fileTables } from './filesSchema';
import { relayTables } from './relaySchema';

export const localeValidator = v.union(
	v.literal('en-US'),
	v.literal('es-419'),
	v.literal('zh-Hans')
);
export const challengePurpose = v.union(v.literal('verify'), v.literal('reset'));
export const assignableOrganizationRole = v.union(v.literal('admin'), v.literal('moderator'));
export const organizationRole = v.union(v.literal('owner'), assignableOrganizationRole);
export const projectVisibility = v.union(
	v.literal('public'),
	v.literal('private'),
	v.literal('archived')
);
export const feedbackStatus = v.union(
	v.literal('open'),
	v.literal('in-progress'),
	v.literal('closed'),
	v.literal('completed'),
	v.literal('paused')
);
export const feedbackPriority = v.union(
	v.literal('none'),
	v.literal('low'),
	v.literal('medium'),
	v.literal('high'),
	v.literal('urgent')
);
export const targetGranularity = v.union(
	v.literal('day'),
	v.literal('month'),
	v.literal('quarter'),
	v.literal('year')
);
export const updateCategory = v.union(
	v.literal('changelog'),
	v.literal('article'),
	v.literal('announcement')
);
export const updateStatus = v.union(v.literal('draft'), v.literal('published'));
export const discussionsPostingPolicy = v.union(v.literal('everyone'), v.literal('team'));
// `qa` categories let the author or a moderator mark one reply as the answer.
export const discussionCategoryFormat = v.union(v.literal('open'), v.literal('qa'));
export const discussionEventType = v.union(
	v.literal('title_changed'),
	v.literal('category_changed'),
	v.literal('pinned'),
	v.literal('unpinned'),
	v.literal('locked'),
	v.literal('unlocked'),
	v.literal('answer_marked'),
	v.literal('answer_unmarked'),
	v.literal('converted_to_feedback')
);
export const emoteReaction = v.union(
	v.literal('heart'),
	v.literal('thumbsUp'),
	v.literal('thumbsDown'),
	v.literal('laugh'),
	v.literal('questionMark'),
	v.literal('sad'),
	v.literal('tada'),
	v.literal('eyes'),
	v.literal('skull'),
	v.literal('explodingHead')
);
export const operationalJobKind = v.union(
	v.literal('storage_cleanup'),
	v.literal('project_deletion'),
	v.literal('feedback_deletion'),
	v.literal('update_deletion'),
	v.literal('storage_project_purge'),
	v.literal('board_deletion')
);
export const maintenanceKind = v.union(v.literal('feedback_upvotes'), v.literal('update_counts'));
export const projectThemePreset = v.union(
	...(
		[
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
		] as const
	).map((value) => v.literal(value))
);
export const projectThemePalette = v.object({
	background: v.string(),
	foreground: v.string(),
	primary: v.string(),
	primaryForeground: v.string(),
	surface: v.string(),
	surfaceForeground: v.string(),
});

// App-owned identity and profile data. Credentials, provider account mappings,
// and sessions belong to the auth components, never to these tables.
export default defineSchema({
	...fileTables,
	...relayTables,
	users: defineTable({
		status: v.union(v.literal('pendingVerification'), v.literal('active'), v.literal('disabled')),
		systemRole: v.union(v.literal('user'), v.literal('system:admin')),
		profileId: v.optional(v.id('profiles')),
		personalOrganizationId: v.optional(v.id('organizations')),
		registrationName: v.optional(v.string()),
		registrationLocale: v.optional(localeValidator),
		githubAccountId: v.optional(v.string()),
		githubEmail: v.optional(v.string()),
		githubEmailVerifiedAt: v.optional(v.number()),
		passwordEmail: v.optional(v.string()),
		passwordEmailVerifiedAt: v.optional(v.number()),
	})
		.index('by_status', ['status'])
		.index('by_passwordEmail', ['passwordEmail'])
		.index('by_githubEmail', ['githubEmail']),
	profiles: defineTable({
		userId: v.id('users'),
		name: v.string(),
		username: v.string(),
		bio: v.optional(v.string()),
		location: v.optional(v.string()),
		urls: v.optional(v.array(v.object({ text: v.string(), url: v.string() }))),
		avatarStorageId: v.optional(v.id('_storage')),
		imageUrl: v.optional(v.string()),
		locale: v.optional(localeValidator),
	})
		.index('by_userId', ['userId'])
		.index('by_username', ['username'])
		.index('by_avatarStorageId', ['avatarStorageId']),
	profileAvatarUploadIntents: defineTable({
		profileId: v.id('profiles'),
		requestedByUserId: v.id('users'),
		token: v.string(),
		storageId: v.optional(v.id('_storage')),
		createdAt: v.number(),
		expiresAt: v.number(),
	})
		.index('by_token', ['token'])
		.index('by_profileId', ['profileId'])
		.index('by_storageId', ['storageId'])
		.index('by_expiresAt', ['expiresAt']),
	imageUploadReconciliation: defineTable({
		key: v.literal('root-storage'),
		checkedThrough: v.number(),
	}).index('by_key', ['key']),
	organizations: defineTable({
		logoStorageId: v.optional(v.id('_storage')),
		name: v.string(),
		slug: v.string(),
		visibility: v.union(v.literal('public'), v.literal('private')),
		personalOwnerId: v.optional(v.id('users')),
	})
		.index('by_slug', ['slug'])
		.index('by_logoStorageId', ['logoStorageId'])
		.index('by_personalOwnerId', ['personalOwnerId']),
	organizationLogoUploadIntents: defineTable({
		organizationId: v.id('organizations'),
		requestedByUserId: v.id('users'),
		token: v.string(),
		storageId: v.optional(v.id('_storage')),
		createdAt: v.number(),
		expiresAt: v.number(),
	})
		.index('by_token', ['token'])
		.index('by_organizationId', ['organizationId'])
		.index('by_storageId', ['storageId'])
		.index('by_expiresAt', ['expiresAt']),
	memberships: defineTable({
		organizationId: v.id('organizations'),
		userId: v.id('users'),
		role: organizationRole,
	})
		.index('by_userId', ['userId'])
		.index('by_organizationId_and_userId', ['organizationId', 'userId'])
		.index('by_organizationId_and_role', ['organizationId', 'role']),
	invitations: defineTable({
		organizationId: v.id('organizations'),
		email: v.string(),
		role: assignableOrganizationRole,
		projectIds: v.array(v.id('projects')),
		inviterId: v.id('users'),
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
		deliveryStatus: v.optional(v.union(v.literal('accepted'), v.literal('failed'))),
	})
		.index('by_organizationId_and_email_and_status', ['organizationId', 'email', 'status'])
		.index('by_organizationId', ['organizationId'])
		.index('by_organizationId_and_status', ['organizationId', 'status']),
	projects: defineTable({
		description: v.optional(v.string()),
		urls: v.optional(
			v.array(
				v.object({
					source: v.string(),
					text: v.string(),
					url: v.string(),
					verifiedAt: v.union(v.null(), v.number()),
				})
			)
		),
		deletingAt: v.optional(v.number()),
		storageDeletingAt: v.optional(v.number()),
		updatesFeaturedMode: v.optional(v.union(v.literal('latest'), v.literal('manual'))),
		// Unset means enabled; projects can hide Discussions entirely.
		discussionsEnabled: v.optional(v.boolean()),
		organizationId: v.id('organizations'),
		name: v.string(),
		slug: v.string(),
		visibility: projectVisibility,
	})
		.index('by_organizationId', ['organizationId'])
		.index('by_organizationId_and_slug', ['organizationId', 'slug']),
	projectThemes: defineTable({
		projectId: v.id('projects'),
		version: v.number(),
		publishedLight: projectThemePalette,
		publishedDark: projectThemePalette,
		publishedPresetId: projectThemePreset,
		publishedRevision: v.number(),
		publishedTime: v.number(),
		publishedByProfileId: v.optional(v.id('profiles')),
	}).index('by_projectId', ['projectId']),
	projectDeletionJobs: defineTable({
		projectId: v.id('projects'),
		invitationsCursor: v.optional(v.string()),
		invitationsDone: v.boolean(),
	}).index('by_projectId', ['projectId']),
	operationalAlerts: defineTable({
		key: v.string(),
		kind: operationalJobKind,
		jobId: v.string(),
		targetId: v.string(),
		state: v.union(v.literal('failed'), v.literal('stalled')),
		firstSeenAt: v.number(),
		lastSeenAt: v.number(),
		lastSentAt: v.optional(v.number()),
		lastAttemptAt: v.optional(v.number()),
		scheduledAt: v.optional(v.number()),
		resolvedAt: v.optional(v.number()),
		suppressedUntil: v.optional(v.number()),
		deliveryStatus: v.union(
			v.literal('pending'),
			v.literal('accepted'),
			v.literal('failed'),
			v.literal('disabled')
		),
		attempt: v.number(),
	})
		.index('by_key', ['key'])
		.index('by_resolvedAt', ['resolvedAt']),
	maintenanceJobs: defineTable({
		kind: maintenanceKind,
		status: v.union(
			v.literal('pending'),
			v.literal('running'),
			v.literal('completed'),
			v.literal('failed')
		),
		dryRun: v.boolean(),
		requestedByUserId: v.id('users'),
		phase: v.optional(v.union(v.literal('comments'), v.literal('emotes'))),
		entityCursor: v.optional(v.string()),
		entityId: v.optional(v.string()),
		childCursor: v.optional(v.string()),
		countA: v.number(),
		countB: v.number(),
		checked: v.number(),
		changed: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
		completedAt: v.optional(v.number()),
		error: v.optional(v.string()),
	})
		.index('by_status', ['status'])
		.index('by_kind_and_status', ['kind', 'status']),
	feedbackBoards: defineTable({
		deletingAt: v.optional(v.number()),
		projectId: v.id('projects'),
		name: v.string(),
		slug: v.string(),
		description: v.optional(v.string()),
		icon: v.optional(v.string()),
		updatedAt: v.optional(v.number()),
	})
		.index('by_projectId', ['projectId'])
		.index('by_projectId_and_slug', ['projectId', 'slug'])
		.index('by_deletingAt', ['deletingAt']),
	feedback: defineTable({
		projectId: v.id('projects'),
		boardId: v.id('feedbackBoards'),
		authorProfileId: v.id('profiles'),
		firstCommentId: v.optional(v.id('feedbackComments')),
		answerCommentId: v.optional(v.id('feedbackComments')),
		assignedProfileId: v.optional(v.id('profiles')),
		slug: v.string(),
		title: v.string(),
		status: feedbackStatus,
		priority: feedbackPriority,
		upvotes: v.number(),
		tags: v.array(v.string()),
		target: v.optional(v.string()),
		targetGranularity: v.optional(targetGranularity),
		searchContent: v.string(),
		updatedAt: v.number(),
		deletingAt: v.optional(v.number()),
	})
		.index('by_projectId', ['projectId'])
		.index('by_projectId_and_slug', ['projectId', 'slug'])
		.index('by_projectId_and_boardId', ['projectId', 'boardId'])
		.index('by_projectId_and_status', ['projectId', 'status'])
		.index('by_projectId_and_boardId_and_status', ['projectId', 'boardId', 'status'])
		.index('by_boardId', ['boardId'])
		.index('by_firstCommentId', ['firstCommentId'])
		.index('by_answerCommentId', ['answerCommentId'])
		.searchIndex('search_by_searchContent', {
			searchField: 'searchContent',
			filterFields: ['projectId', 'boardId', 'status'],
		}),
	feedbackComments: defineTable({
		feedbackId: v.id('feedback'),
		authorProfileId: v.id('profiles'),
		replyFeedbackCommentId: v.optional(v.id('feedbackComments')),
		content: v.string(),
		initial: v.boolean(),
		updatedAt: v.optional(v.number()),
	})
		.index('by_feedbackId', ['feedbackId'])
		.index('by_authorProfileId', ['authorProfileId'])
		.index('by_replyFeedbackCommentId', ['replyFeedbackCommentId']),
	feedbackUpvotes: defineTable({
		feedbackId: v.id('feedback'),
		authorProfileId: v.id('profiles'),
	}).index('by_feedbackId_and_authorProfileId', ['feedbackId', 'authorProfileId']),
	feedbackCommentEmotes: defineTable({
		feedbackId: v.id('feedback'),
		feedbackCommentId: v.id('feedbackComments'),
		authorProfileId: v.id('profiles'),
		content: v.string(),
		updatedAt: v.number(),
	})
		.index('by_feedbackCommentId', ['feedbackCommentId'])
		.index('by_feedbackCommentId_and_authorProfileId_and_content', [
			'feedbackCommentId',
			'authorProfileId',
			'content',
		])
		.index('by_feedbackId', ['feedbackId']),
	feedbackEvents: defineTable({
		feedbackId: v.id('feedback'),
		actorProfileId: v.id('profiles'),
		eventType: v.union(
			v.literal('status_changed'),
			v.literal('priority_changed'),
			v.literal('title_changed'),
			v.literal('board_changed'),
			v.literal('answer_marked'),
			v.literal('answer_unmarked'),
			v.literal('assigned'),
			v.literal('unassigned'),
			v.literal('imported_from_discussion')
		),
		metadata: v.optional(
			v.object({
				oldValue: v.optional(v.string()),
				newValue: v.optional(v.string()),
				targetProfileId: v.optional(v.id('profiles')),
				discussionId: v.optional(v.id('discussions')),
			})
		),
	}).index('by_feedbackId', ['feedbackId']),
	feedbackTimelineEntries: defineTable({
		feedbackId: v.id('feedback'),
		kind: v.union(v.literal('comment'), v.literal('event')),
		commentId: v.optional(v.id('feedbackComments')),
		eventId: v.optional(v.id('feedbackEvents')),
	})
		.index('by_feedbackId', ['feedbackId'])
		.index('by_commentId', ['commentId'])
		.index('by_eventId', ['eventId']),
	feedbackWatchers: defineTable({
		feedbackId: v.id('feedback'),
		profileId: v.id('profiles'),
	}).index('by_feedbackId_and_profileId', ['feedbackId', 'profileId']),
	feedbackRelations: defineTable({
		projectId: v.id('projects'),
		feedbackId: v.id('feedback'),
		relatedFeedbackId: v.id('feedback'),
		createdByProfileId: v.id('profiles'),
	})
		.index('by_feedbackId', ['feedbackId'])
		.index('by_relatedFeedbackId', ['relatedFeedbackId'])
		.index('by_feedbackId_and_relatedFeedbackId', ['feedbackId', 'relatedFeedbackId']),
	feedbackDeletionJobs: defineTable({
		feedbackId: v.id('feedback'),
		requestedByProfileId: v.id('profiles'),
		startedAt: v.number(),
	}).index('by_feedbackId', ['feedbackId']),
	updates: defineTable({
		coverAssetId: v.optional(v.id('fileAssets')),
		projectId: v.id('projects'),
		authorProfileId: v.id('profiles'),
		slug: v.string(),
		title: v.string(),
		content: v.string(),
		searchContent: v.string(),
		category: updateCategory,
		status: updateStatus,
		tags: v.array(v.string()),
		relatedFeedbackIds: v.array(v.id('feedback')),
		featuredAt: v.optional(v.number()),
		publishedAt: v.optional(v.number()),
		updatedAt: v.number(),
		deletingAt: v.optional(v.number()),
		commentCount: v.number(),
		heartCount: v.number(),
	})
		.index('by_projectId_and_slug', ['projectId', 'slug'])
		.index('by_projectId_and_updatedAt', ['projectId', 'updatedAt'])
		.index('by_projectId_and_status_and_publishedAt', ['projectId', 'status', 'publishedAt'])
		.index('by_projectId_and_category_and_status_and_publishedAt', [
			'projectId',
			'category',
			'status',
			'publishedAt',
		])
		.index('by_projectId_and_status_and_featuredAt', ['projectId', 'status', 'featuredAt'])
		.searchIndex('search_by_searchContent', {
			searchField: 'searchContent',
			filterFields: ['projectId', 'status', 'category'],
		}),
	updateComments: defineTable({
		updateId: v.id('updates'),
		authorProfileId: v.id('profiles'),
		content: v.string(),
		replyCommentId: v.optional(v.id('updateComments')),
		updatedAt: v.optional(v.number()),
		emoteCounts: v.record(v.string(), v.number()),
	})
		.index('by_updateId', ['updateId'])
		.index('by_authorProfileId', ['authorProfileId'])
		.index('by_replyCommentId', ['replyCommentId']),
	updateEmotes: defineTable({
		updateId: v.id('updates'),
		authorProfileId: v.id('profiles'),
		content: v.string(),
	}).index('by_updateId_and_authorProfileId_and_content', [
		'updateId',
		'authorProfileId',
		'content',
	]),
	updateCommentEmotes: defineTable({
		updateId: v.id('updates'),
		commentId: v.id('updateComments'),
		authorProfileId: v.id('profiles'),
		content: v.string(),
	})
		.index('by_updateId', ['updateId'])
		.index('by_commentId_and_authorProfileId_and_content', [
			'commentId',
			'authorProfileId',
			'content',
		]),
	// Topics a project's discussions are filed under. Each carries its own
	// posting policy (Announcements are team-only) and format (Q&A answers).
	discussionCategories: defineTable({
		projectId: v.id('projects'),
		name: v.string(),
		slug: v.string(),
		description: v.optional(v.string()),
		icon: v.optional(v.string()),
		format: discussionCategoryFormat,
		postingPolicy: discussionsPostingPolicy,
		position: v.number(),
		updatedAt: v.optional(v.number()),
		deletingAt: v.optional(v.number()),
	})
		.index('by_projectId_and_position', ['projectId', 'position'])
		.index('by_projectId_and_slug', ['projectId', 'slug']),
	// A discussion's body is its `initial` comment so it renders and reacts like
	// every reply. `commentCount` excludes that initial comment.
	discussions: defineTable({
		projectId: v.id('projects'),
		// Optional only for discussions created before categories existed.
		categoryId: v.optional(v.id('discussionCategories')),
		authorProfileId: v.id('profiles'),
		firstCommentId: v.optional(v.id('discussionComments')),
		answerCommentId: v.optional(v.id('discussionComments')),
		slug: v.string(),
		title: v.string(),
		searchContent: v.string(),
		commentCount: v.number(),
		lastActivityAt: v.number(),
		pinnedAt: v.optional(v.number()),
		lockedAt: v.optional(v.number()),
		// Set when a moderator converts the discussion into feedback.
		convertedFeedbackId: v.optional(v.id('feedback')),
		deletingAt: v.optional(v.number()),
	})
		.index('by_projectId', ['projectId'])
		.index('by_projectId_and_slug', ['projectId', 'slug'])
		.index('by_projectId_and_lastActivityAt', ['projectId', 'lastActivityAt'])
		.index('by_projectId_and_commentCount', ['projectId', 'commentCount'])
		.index('by_projectId_and_pinnedAt', ['projectId', 'pinnedAt'])
		.index('by_projectId_and_authorProfileId_and_lastActivityAt', [
			'projectId',
			'authorProfileId',
			'lastActivityAt',
		])
		.index('by_categoryId', ['categoryId'])
		.index('by_categoryId_and_lastActivityAt', ['categoryId', 'lastActivityAt'])
		.index('by_categoryId_and_commentCount', ['categoryId', 'commentCount'])
		.searchIndex('search_by_searchContent', {
			searchField: 'searchContent',
			filterFields: ['projectId', 'categoryId'],
		}),
	discussionComments: defineTable({
		discussionId: v.id('discussions'),
		authorProfileId: v.id('profiles'),
		content: v.string(),
		initial: v.boolean(),
		updatedAt: v.optional(v.number()),
	})
		.index('by_discussionId_and_initial', ['discussionId', 'initial'])
		.index('by_authorProfileId', ['authorProfileId']),
	discussionCommentEmotes: defineTable({
		discussionId: v.id('discussions'),
		commentId: v.id('discussionComments'),
		authorProfileId: v.id('profiles'),
		content: emoteReaction,
	})
		.index('by_discussionId', ['discussionId'])
		.index('by_commentId_and_authorProfileId_and_content', [
			'commentId',
			'authorProfileId',
			'content',
		]),
	// Following records interest today; notifications will read it later.
	discussionWatchers: defineTable({
		projectId: v.id('projects'),
		discussionId: v.id('discussions'),
		profileId: v.id('profiles'),
	})
		.index('by_discussionId_and_profileId', ['discussionId', 'profileId'])
		.index('by_profileId_and_projectId', ['profileId', 'projectId']),
	// Moderation and housekeeping changes, shown between replies in the thread.
	discussionEvents: defineTable({
		discussionId: v.id('discussions'),
		actorProfileId: v.id('profiles'),
		eventType: discussionEventType,
		metadata: v.optional(
			v.object({
				oldValue: v.optional(v.string()),
				newValue: v.optional(v.string()),
				feedbackId: v.optional(v.id('feedback')),
			})
		),
	}).index('by_discussionId', ['discussionId']),
	// Links from a discussion to feedback or an update in the same project.
	discussionLinks: defineTable({
		projectId: v.id('projects'),
		discussionId: v.id('discussions'),
		feedbackId: v.optional(v.id('feedback')),
		updateId: v.optional(v.id('updates')),
		createdByProfileId: v.id('profiles'),
	})
		.index('by_discussionId', ['discussionId'])
		.index('by_feedbackId', ['feedbackId'])
		.index('by_updateId', ['updateId']),
	updateDeletionJobs: defineTable({ updateId: v.id('updates') }).index('by_updateId', ['updateId']),
	projectModeratorAssignments: defineTable({
		membershipId: v.id('memberships'),
		projectId: v.id('projects'),
	})
		.index('by_membershipId_and_projectId', ['membershipId', 'projectId'])
		.index('by_projectId', ['projectId']),
	projectMembers: defineTable({
		projectId: v.id('projects'),
		userId: v.id('users'),
	}).index('by_projectId_and_userId', ['projectId', 'userId']),
	authChallenges: defineTable({
		userId: v.id('users'),
		purpose: challengePurpose,
		hash: v.string(),
		expiresAt: v.number(),
	})
		.index('by_hash', ['hash'])
		.index('by_userId_and_purpose', ['userId', 'purpose'])
		.index('by_expiresAt', ['expiresAt']),
});
