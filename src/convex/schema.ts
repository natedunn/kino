import { defineSchema } from 'convex/server';

import { defineZTable } from '@/convex/api/utils/table';

import { feedback } from './schema/feedback.schema';
import { feedbackBoard } from './schema/feedbackBoard.schema';
import { feedbackComment } from './schema/feedbackComment.schema';
import { feedbackCommentEmote } from './schema/feedbackCommentEmote.schema';
import { projectSchema } from './schema/project.schema';
import { projectUser } from './schema/projectUser.schema';
import { userSchema } from './schema/user.schema';

const schema = defineSchema({
	user: defineZTable(userSchema)
		.index('by_username', ['username'])
		.index('by_email', ['email'])
		.index('by_globalRole', ['globalRole']),
	project: defineZTable(projectSchema)
		.index('by_orgSlug', ['orgSlug'])
		.index('by_slug', ['slug'])
		.index('by_updatedTime', ['updatedTime'])
		.index('by_orgSlug_slug', ['orgSlug', 'slug'])
		.index('by_orgSlug_visibility_updatedAt', ['orgSlug', 'visibility', 'updatedTime']),
	projectUser: defineZTable(projectUser)
		.index('by_userId_projectId', ['userId', 'projectId'])
		.index('by_userId_projectId_role', ['userId', 'projectId', 'role']),
	feedback: defineZTable(feedback)
		.index('by_projectId', ['projectId'])
		.index('by_board', ['board'])
		.index('by_authorUserId', ['authorUserId']),
	feedbackBoard: defineZTable(feedbackBoard)
		.index('by_projectId', ['projectId'])
		.index('by_name_projectId', ['name', 'projectId']),
	feedbackComment: defineZTable(feedbackComment)
		.index('by_feedbackId', ['feedbackId'])
		.index('by_authorUserId', ['authorUserId']),
	feedbackCommentEmote: defineZTable(feedbackCommentEmote)
		.index('by_authorUserId', ['authorUserId'])
		.index('by_feedbackId', ['feedbackId'])
		.index('by_feedbackCommentId', ['feedbackCommentId']),
});

export default schema;
