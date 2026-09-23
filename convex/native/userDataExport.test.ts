// @vitest-environment edge-runtime
import type { Id } from './_generated/dataModel';

import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { beforeEach, describe, expect, test } from 'vitest';

import { configureTestAuth, issuer } from '../testing/setup.testing';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.testing.ts']);
const generatedAt = Date.UTC(2026, 8, 22);
const exportData = makeFunctionReference<
	'query',
	{ generatedAt: number; sections?: Array<'comments'> },
	{
		format: 'kino-user-data-export';
		version: number;
		generatedAt: string;
		account: {
			userId: Id<'users'>;
			profileId: Id<'profiles'>;
			username: string;
			email: string | null;
		};
		sections: {
			comments?: {
				counts: { feedbackComments: number; updateComments: number; total: number };
				feedbackComments: Array<{
					content: string;
					context: Record<string, unknown>;
					createdAt: string | null;
				}>;
				updateComments: Array<{
					content: string;
					context: Record<string, unknown>;
					createdAt: string | null;
				}>;
			};
		};
	}
>('userDataExport:exportData');
const getAvailableSections = makeFunctionReference<
	'query',
	Record<string, never>,
	Array<{ id: 'comments'; label: string; description: string; includedByDefault: boolean }>
>('userDataExport:getAvailableSections');

beforeEach(configureTestAuth);

function setup() {
	const t = convexTest(schema, modules);
	registerRateLimiter(t, 'authLimits');
	return t;
}

type Backend = ReturnType<typeof setup>;

async function addUser(t: Backend, name: string, email = `${name}@example.test`) {
	const ids = await t.run(async (ctx) => {
		const userId = await ctx.db.insert('users', {
			status: 'active',
			systemRole: 'user',
			passwordEmail: email,
			passwordEmailVerifiedAt: Date.now(),
		});
		const profileId = await ctx.db.insert('profiles', {
			userId,
			name,
			username: name.toLowerCase(),
		});
		await ctx.db.patch('users', userId, { profileId });
		return { profileId, userId };
	});
	return { ...ids, caller: t.withIdentity({ issuer, subject: ids.userId }) };
}

async function addProject(
	t: Backend,
	ownerId: Id<'users'> | null,
	visibility: 'public' | 'private' | 'archived' = 'public'
) {
	return t.run(async (ctx) => {
		const organizationId = await ctx.db.insert('organizations', {
			name: 'Acme',
			slug: `acme-${Math.random().toString(36).slice(2)}`,
			visibility: 'public',
		});
		if (ownerId) {
			await ctx.db.insert('memberships', { organizationId, userId: ownerId, role: 'owner' });
		}
		const projectId = await ctx.db.insert('projects', {
			organizationId,
			name: 'Roadmap',
			slug: 'roadmap',
			visibility,
		});
		const boardId = await ctx.db.insert('feedbackBoards', {
			projectId,
			name: 'Bugs',
			slug: 'bugs',
		});
		return { boardId, organizationId, projectId };
	});
}

async function addFeedbackComment(
	t: Backend,
	args: {
		authorProfileId: Id<'profiles'>;
		boardId: Id<'feedbackBoards'>;
		projectId: Id<'projects'>;
		content: string;
	}
) {
	return t.run(async (ctx) => {
		const feedbackId = await ctx.db.insert('feedback', {
			projectId: args.projectId,
			boardId: args.boardId,
			authorProfileId: args.authorProfileId,
			slug: `feedback-${Math.random().toString(36).slice(2)}`,
			title: 'Feedback title',
			status: 'open',
			priority: 'none',
			upvotes: 0,
			tags: [],
			searchContent: 'Feedback title',
			updatedAt: Date.now(),
		});
		const commentId = await ctx.db.insert('feedbackComments', {
			feedbackId,
			authorProfileId: args.authorProfileId,
			content: args.content,
			initial: false,
		});
		return { commentId, feedbackId };
	});
}

async function addUpdateComment(
	t: Backend,
	args: {
		authorProfileId: Id<'profiles'>;
		projectId: Id<'projects'>;
		content: string;
		status?: 'draft' | 'published';
	}
) {
	return t.run(async (ctx) => {
		const updateId = await ctx.db.insert('updates', {
			projectId: args.projectId,
			authorProfileId: args.authorProfileId,
			slug: `update-${Math.random().toString(36).slice(2)}`,
			title: 'Update title',
			content: 'Update body',
			searchContent: 'Update title Update body',
			category: 'announcement',
			status: args.status ?? 'published',
			tags: [],
			relatedFeedbackIds: [],
			updatedAt: Date.now(),
			commentCount: 1,
			heartCount: 0,
		});
		const commentId = await ctx.db.insert('updateComments', {
			updateId,
			authorProfileId: args.authorProfileId,
			content: args.content,
			emoteCounts: {},
		});
		return { commentId, updateId };
	});
}

describe('native user data export', () => {
	test('requires the signed-in current user for sections and exports', async () => {
		const t = setup();
		await expect(t.query(getAvailableSections, {})).rejects.toThrow('UNAUTHORIZED');
		await expect(t.query(exportData, { generatedAt })).rejects.toThrow('UNAUTHORIZED');

		const user = await addUser(t, 'Owner');
		expect(await user.caller.query(getAvailableSections, {})).toEqual([
			expect.objectContaining({ id: 'comments', includedByDefault: true }),
		]);
		const result = await user.caller.query(exportData, { generatedAt, sections: [] });
		expect(result.sections).toEqual({});
		expect(result.generatedAt).toBe(new Date(generatedAt).toISOString());
		expect(result.account).toEqual({
			userId: user.userId,
			profileId: user.profileId,
			username: 'owner',
			email: 'Owner@example.test',
		});
	});

	test('exports only the linked profile comments with visible context and ISO dates', async () => {
		const t = setup();
		const owner = await addUser(t, 'Owner');
		const other = await addUser(t, 'Other');
		const project = await addProject(t, owner.userId);
		await addFeedbackComment(t, {
			authorProfileId: owner.profileId,
			boardId: project.boardId,
			projectId: project.projectId,
			content: 'Please fix this',
		});
		await addFeedbackComment(t, {
			authorProfileId: other.profileId,
			boardId: project.boardId,
			projectId: project.projectId,
			content: "Someone else's comment",
		});
		await addUpdateComment(t, {
			authorProfileId: owner.profileId,
			projectId: project.projectId,
			content: 'Looks good',
		});

		const result = await owner.caller.query(exportData, { generatedAt });
		const comments = result.sections.comments!;
		expect(comments.counts).toEqual({ feedbackComments: 1, updateComments: 1, total: 2 });
		expect(comments.feedbackComments[0]).toMatchObject({
			content: 'Please fix this',
			context: {
				contextAccess: 'visible',
				board: { slug: 'bugs' },
				feedback: { title: 'Feedback title' },
				project: { slug: 'roadmap' },
			},
		});
		expect(comments.updateComments[0]).toMatchObject({
			content: 'Looks good',
			context: {
				contextAccess: 'visible',
				update: { title: 'Update title' },
				project: { slug: 'roadmap' },
			},
		});
		expect(new Date(comments.feedbackComments[0].createdAt!).toISOString()).toBe(
			comments.feedbackComments[0].createdAt
		);
	});

	test('withholds private and draft parent context after access is lost', async () => {
		const t = setup();
		const author = await addUser(t, 'Author');
		const project = await addProject(t, null, 'private');
		await addFeedbackComment(t, {
			authorProfileId: author.profileId,
			boardId: project.boardId,
			projectId: project.projectId,
			content: 'Private feedback',
		});
		await addUpdateComment(t, {
			authorProfileId: author.profileId,
			projectId: project.projectId,
			content: 'Private draft',
			status: 'draft',
		});

		const comments = (await author.caller.query(exportData, { generatedAt })).sections.comments!;
		expect(comments.feedbackComments[0].context).toMatchObject({
			contextAccess: 'inaccessible',
			projectId: project.projectId,
		});
		expect(comments.updateComments[0].context).toMatchObject({
			contextAccess: 'inaccessible',
			projectId: project.projectId,
		});
	});

	test('returns missing context for deleted and tombstoned parents', async () => {
		const t = setup();
		const owner = await addUser(t, 'Owner');
		const project = await addProject(t, owner.userId);
		const deleted = await addFeedbackComment(t, {
			authorProfileId: owner.profileId,
			boardId: project.boardId,
			projectId: project.projectId,
			content: 'Deleted feedback',
		});
		const tombstoned = await addUpdateComment(t, {
			authorProfileId: owner.profileId,
			projectId: project.projectId,
			content: 'Deleted update',
		});
		await t.run(async (ctx) => {
			await ctx.db.delete('feedback', deleted.feedbackId);
			await ctx.db.patch('updates', tombstoned.updateId, { deletingAt: Date.now() });
		});

		const comments = (await owner.caller.query(exportData, { generatedAt })).sections.comments!;
		expect(comments.feedbackComments[0].context).toEqual({
			contextAccess: 'missing',
			feedbackId: deleted.feedbackId,
		});
		expect(comments.updateComments[0].context).toEqual({
			contextAccess: 'missing',
			updateId: tombstoned.updateId,
		});
	});

	test('rejects a source over 200 comments before resolving contexts', async () => {
		const t = setup();
		const owner = await addUser(t, 'Owner');
		const project = await addProject(t, owner.userId);
		const parent = await addFeedbackComment(t, {
			authorProfileId: owner.profileId,
			boardId: project.boardId,
			projectId: project.projectId,
			content: 'First',
		});
		await t.run(async (ctx) => {
			for (let index = 1; index <= 200; index += 1) {
				await ctx.db.insert('feedbackComments', {
					feedbackId: parent.feedbackId,
					authorProfileId: owner.profileId,
					content: `Comment ${index}`,
					initial: false,
				});
			}
		});
		await expect(owner.caller.query(exportData, { generatedAt })).rejects.toThrow(
			/comments export is too large/i
		);
	});

	test('rejects a serialized export over 900KB', async () => {
		const t = setup();
		const owner = await addUser(t, 'Owner');
		const project = await addProject(t, owner.userId);
		await addUpdateComment(t, {
			authorProfileId: owner.profileId,
			projectId: project.projectId,
			content: 'x'.repeat(901_000),
		});

		await expect(owner.caller.query(exportData, { generatedAt })).rejects.toThrow(
			/Your export is too large for immediate download/i
		);
	});
});
