import { zodToConvex } from 'convex-helpers/server/zod4';
import { defineSchema, defineTable } from 'convex/server';

import { feedbackSchema } from './schema/feedback.schema';
import { feedbackBoardSchema } from './schema/feedbackBoard.schema';
import { feedbackCommentSchema } from './schema/feedbackComment.schema';
import { feedbackCommentEmoteSchema } from './schema/feedbackCommentEmote.schema';
import { feedbackEventSchema } from './schema/feedbackEvent.schema';
import { orgMemberSchema } from './schema/orgMember.schema';
import { profileSchema } from './schema/profile.schema';
import { projectSchema } from './schema/project.schema';
import { projectMemberSchema } from './schema/projectMember.schema';

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
});

export default schema;
