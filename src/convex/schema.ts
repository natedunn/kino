import { defineSchema } from 'convex/server';

import { feedback } from './schema/feedback.schema';
import { feedbackBoard } from './schema/feedbackBoard.schema';
import { feedbackComment } from './schema/feedbackComment.schema';
import { feedbackCommentEmote } from './schema/feedbackCommentEmote.schema';
import { profileSchema } from './schema/profile.schema';
import { projectSchema } from './schema/project.schema';
import { projectProfile } from './schema/projectProfile.schema';
import { defineZTable } from './utils/table';

const schema = defineSchema({
	profile: defineZTable(profileSchema),
	project: defineZTable(projectSchema)
		.index('by_orgSlug', ['orgSlug'])
		.index('by_slug', ['slug'])
		.index('by_updatedTime', ['updatedTime'])
		.index('by_orgSlug_slug', ['orgSlug', 'slug'])
		.index('by_orgSlug_visibility_updatedAt', ['orgSlug', 'visibility', 'updatedTime']),
	projectProfile: defineZTable(projectProfile)
		.index('by_profileId_projectId', ['profileId', 'projectId'])
		.index('by_profileId_projectId_role', ['profileId', 'projectId', 'role']),
	feedback: defineZTable(feedback)
		.index('by_projectId', ['projectId'])
		.index('by_board', ['board'])
		.index('by_authorProfileId', ['authorProfileId']),
	feedbackBoard: defineZTable(feedbackBoard)
		.index('by_projectId', ['projectId'])
		.index('by_name_projectId', ['name', 'projectId']),
	feedbackComment: defineZTable(feedbackComment)
		.index('by_feedbackId', ['feedbackId'])
		.index('by_authorProfileId', ['authorProfileId']),
	feedbackCommentEmote: defineZTable(feedbackCommentEmote)
		.index('by_authorProfileId', ['authorProfileId'])
		.index('by_feedbackId', ['feedbackId'])
		.index('by_feedbackCommentId', ['feedbackCommentId']),
});

export default schema;
