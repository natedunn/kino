import { zodToConvex } from 'convex-helpers/server/zod4';
import { defineSchema, defineTable } from 'convex/server';

import { feedbackSchema } from './schema/feedback.schema';
import { feedbackBoardSchema } from './schema/feedbackBoard.schema';
import { feedbackCommentSchema } from './schema/feedbackComment.schema';
import { feedbackCommentEmoteSchema } from './schema/feedbackCommentEmote.schema';
import { feedbackEventSchema } from './schema/feedbackEvent.schema';
import { feedbackUpvoteSchema } from './schema/feedbackUpvote.schema';
import { orgMemberSchema } from './schema/orgMember.schema';
import { profileSchema } from './schema/profile.schema';
import { projectSchema } from './schema/project.schema';
import { projectMemberSchema } from './schema/projectMember.schema';
import { updateSchema } from './schema/update.schema';
import { updateCommentSchema } from './schema/updateComment.schema';
import { updateCommentEmoteSchema } from './schema/updateCommentEmote.schema';
import { updateEmoteSchema } from './schema/updateEmote.schema';

const schema = defineSchema({
	profile: defineTable(zodToConvex(profileSchema))
		.index('by_username', ['username'])
		.index('by_userId', ['userId']),
	project: defineTable(zodToConvex(projectSchema))
		.index('by_orgSlug', ['orgSlug'])
		.index('by_slug', ['slug'])
		.index('by_updatedTime', ['updatedTime'])
		.index('by_orgSlug_slug', ['orgSlug', 'slug'])
		.index('by_orgSlug_visibility_updatedAt', ['orgSlug', 'visibility', 'updatedTime']),
	projectMember: defineTable(zodToConvex(projectMemberSchema))
		.index('by_projectId', ['projectId'])
		.index('by_profileId_projectId', ['profileId', 'projectId'])
		.index('by_profileId_projectSlug', ['profileId', 'projectSlug'])
		.index('by_profileId_projectId_role', ['profileId', 'projectId', 'role'])
		.index('by_profileId_projectSlug_role', ['profileId', 'projectSlug', 'role']),
	orgMember: defineTable(zodToConvex(orgMemberSchema))
		.index('by_profileId_organizationId', ['profileId', 'organizationId'])
		.index('by_profileId_orgSlug', ['profileId', 'orgSlug']),
	feedback: defineTable(zodToConvex(feedbackSchema))
		.index('by_slug', ['slug'])
		.index('by_projectId', ['projectId'])
		// .index('by_projectId_title', ['projectId', 'title']) // FAKE: remove after testing
		.index('by_projectId_slug', ['projectId', 'slug'])
		.index('by_projectId_boardId', ['projectId', 'boardId'])
		.index('by_projectId_status', ['projectId', 'status'])
		.index('by_projectId_boardId_status', ['projectId', 'boardId', 'status'])
		.searchIndex('by_projectId_boardId_status_searchContent', {
			searchField: 'searchContent',
			filterFields: ['projectId', 'boardId', 'status'],
		}),
	feedbackBoard: defineTable(zodToConvex(feedbackBoardSchema))
		.index('by_projectId', ['projectId'])
		.index('by_slug_projectId', ['slug', 'projectId']),
	feedbackComment: defineTable(zodToConvex(feedbackCommentSchema))
		.index('by_feedbackId', ['feedbackId'])
		.index('by_authorProfileId', ['authorProfileId']),
	feedbackCommentEmote: defineTable(zodToConvex(feedbackCommentEmoteSchema))
		.index('by_authorProfileId', ['authorProfileId'])
		.index('by_feedbackId', ['feedbackId'])
		.index('by_feedbackCommentId', ['feedbackCommentId']),
	feedbackEvent: defineTable(zodToConvex(feedbackEventSchema)).index('by_feedbackId', ['feedbackId']),
	feedbackUpvote: defineTable(zodToConvex(feedbackUpvoteSchema))
		.index('by_feedbackId', ['feedbackId'])
		.index('by_feedbackId_authorProfileId', ['feedbackId', 'authorProfileId']),
	update: defineTable(zodToConvex(updateSchema))
		.index('by_projectId_slug', ['projectId', 'slug'])
		.index('by_projectId_status_publishedAt', ['projectId', 'status', 'publishedAt']),
	updateComment: defineTable(zodToConvex(updateCommentSchema))
		.index('by_updateId', ['updateId'])
		.index('by_authorProfileId', ['authorProfileId']),
	updateEmote: defineTable(zodToConvex(updateEmoteSchema))
		.index('by_updateId', ['updateId'])
		.index('by_updateId_authorProfileId', ['updateId', 'authorProfileId']),
	updateCommentEmote: defineTable(zodToConvex(updateCommentEmoteSchema))
		.index('by_updateCommentId', ['updateCommentId'])
		.index('by_updateId', ['updateId']),
});

export default schema;
