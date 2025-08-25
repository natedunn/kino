import { zid } from 'convex-helpers/server/zod';
import { defineSchema, GenericDataModel, TableNamesInDataModel } from 'convex/server';
import { z } from 'zod';

import { defineZTable } from '@/convex/api/utils/table';

export const SHARED_SCHEMA = <
	DataModel extends GenericDataModel,
	TableName extends TableNamesInDataModel<DataModel> = TableNamesInDataModel<DataModel>,
>(
	id: TableName
) => {
	return {
		_id: zid(id),
		_creationTime: z.number(),
		deletedTime: z.number().optional(),
		updatedTime: z.number().optional().default(Date.now()),
	};
};

export const userSchema = z.object({
	...SHARED_SCHEMA('user'),
	email: z.string().email(),
	imageUrl: z.string().url().optional(),
	username: z.string().min(3).max(20),
	name: z.string().min(1).max(100),
	bio: z.string().max(150).optional(),
	banned: z.boolean().default(false),
	private: z.boolean().default(false),
	globalRole: z.enum(['user', 'admin']).default('user'),
	location: z.string().optional(),
	urls: z.object({ url: z.string().url(), text: z.string() }).array().optional().default([]),
});

export const projectSchema = z.object({
	...SHARED_SCHEMA('project'),
	teamId: z.string(),
	name: z.string().max(100).min(1),
	description: z.string().max(280).optional(),
	urls: z.object({ url: z.string().url(), text: z.string() }).array().optional(),
	private: z.boolean(),
	logoUrl: z.string().url().optional(),
	slug: z
		.string()
		.regex(/^[a-z0-9_]+(?:-[a-z0-9_]+)*$/, {
			message:
				'Invalid slug format. Slugs can only contain lowercase letters, numbers, underscores, and hyphens. They cannot start or end with a hyphen, or have consecutive hyphens.',
		})
		.min(1, 'Slug cannot be empty.')
		.max(100, 'Slug cannot be longer than 100 characters.'),
});

export const projectUserSchema = z.object({
	...SHARED_SCHEMA('projectUser'),
	projectId: zid('project'),
	userId: zid('user'),
	role: z.enum(['admin', 'member', 'owner']).default('member'),
	projectIsPrivate: z.boolean(),
});

export const feedbackBoard = z.object({
	...SHARED_SCHEMA('feedbackBoard'),
	name: z.string().min(1).max(50),
	projectId: zid('project'),
});

export const feedback = z.object({
	...SHARED_SCHEMA('feedback'),
	content: z.string().min(1).max(500),
	authorUserId: zid('user'),
	projectId: zid('project'),
	upvotes: z.number().default(0),
	board: zid('feedbackBoard'),
});

export const feedbackComment = z.object({
	...SHARED_SCHEMA('feedbackComment'),
	feedbackId: zid('feedback'),
	authorUserId: zid('user'),
	replyFeedbackCommentId: zid('feedbackComment').optional(),
	content: z.string().min(1).max(1200),
	// emoteCounts: z.record(feedbackCommentEmotes.shape.content, z.number().optional()),
});

export const feedbackCommentEmote = z.object({
	...SHARED_SCHEMA('feedbackCommentEmote'),
	authorUserId: zid('user'),
	content: z.enum([
		// 👍 👎 😄 ❓ 🙁 🎉 👀 ❤️ 💀 🤯
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
	]),
});

/**
 * ✨ All Schemas
 */
const schema = defineSchema({
	user: defineZTable(userSchema)
		.index('by_username', ['username'])
		.index('by_email', ['email'])
		.index('by_globalRole', ['globalRole']),
	project: defineZTable(projectSchema)
		// .index('by_ownerUserId', ['ownerUserId'])
		.index('by_slug', ['slug'])
		.index('by_private', ['private'])
		.index('by_updatedTime', ['updatedTime'])
		.index('by_private_updateTime', ['private', 'updatedTime']),
	projectUser: defineZTable(projectUserSchema)
		.index('by_projectId', ['projectId'])
		.index('by_userId', ['userId'])
		.index('by_userId_projectIsPrivate', ['projectIsPrivate', 'userId'])
		.index('by_projectUser', ['projectId', 'userId']),
	feedbackBoard: defineZTable(feedbackBoard),
	feedback: defineZTable(feedback)
		.index('by_projectId', ['projectId'])
		.index('by_authorUserId', ['authorUserId']),
	feedbackComment: defineZTable(feedbackComment)
		.index('by_feedbackId', ['feedbackId'])
		.index('by_authorUserId', ['authorUserId']),
	feedbackCommentEmote: defineZTable(feedbackCommentEmote).index('by_authorUserId', [
		'authorUserId',
	]),
});

export default schema;
