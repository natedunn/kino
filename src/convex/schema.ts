import { zid } from 'convex-helpers/server/zod';
import { defineSchema } from 'convex/server';
import { z } from 'zod';

import { defineZTable } from '@/convex/api/utils/table';

export const userSchema = z.object({
	_id: zid('user'),
	_creationTime: z.number(),
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
	_id: zid('project'),
	ownerUserId: zid('user'),
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
	_creationTime: z.number(),
	updatedTime: z.number().optional().default(Date.now()),
	deletedTime: z.number().optional(),
});

export const projectUserSchema = z.object({
	_id: zid('projectUser'),
	projectId: zid('project'),
	userId: zid('user'),
	role: z.enum(['admin', 'member', 'owner']).default('member'),
	projectIsPrivate: z.boolean(),
});

export const feedback = z.object({
	_id: zid('feedback'),
	_creationTime: z.number(),
	updatedTime: z.number().optional().default(Date.now()),
	deletedTime: z.number().optional(),
	content: z.string().min(1).max(500),
	authorUserId: zid('user'),
	projectId: zid('project'),
	upvotes: z.number().default(0),
});

export const feedbackComments = z.object({
	_id: zid('feedbackComments'),
	_creationTime: z.number(),
	feedbackId: zid('feedback'),
	authorUserId: zid('user'),
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
		.index('by_ownerUserId', ['ownerUserId'])
		.index('by_slug', ['slug'])
		.index('by_private', ['private'])
		.index('by_updatedTime', ['updatedTime'])
		.index('by_private_updateTime', ['private', 'updatedTime']),
	projectUser: defineZTable(projectUserSchema)
		.index('by_projectId', ['projectId'])
		.index('by_userId', ['userId'])
		.index('by_userId_projectIsPrivate', ['projectIsPrivate', 'userId'])
		.index('by_projectUser', ['projectId', 'userId']),
});

export default schema;
