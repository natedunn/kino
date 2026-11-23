// @vitest-environment edge-runtime
import { registerCore } from '@convex-dev/auth/test';
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { configureTestAuth, sessionFor } from '../testing/setup.testing';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.testing.ts']);

beforeEach(async () => {
	await configureTestAuth();
	vi.useFakeTimers();
	for (const key of ['BENTO_PUBLISHABLE_KEY', 'BENTO_SECRET_KEY', 'BENTO_SITE_UUID', 'BENTO_FROM'])
		vi.stubEnv(key, 'test-only');
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.useRealTimers();
});

async function fixture() {
	const t = convexTest(schema, modules);
	registerCore(t);
	registerRateLimiter(t, 'authLimits');
	const createUser = async (label: string) => {
		const ids = await t.run(async (ctx) => {
			const userId = await ctx.db.insert('users', {
				status: 'active',
				systemRole: 'user',
				passwordEmail: `${label}@example.test`,
				passwordEmailVerifiedAt: Date.now(),
			});
			const profileId = await ctx.db.insert('profiles', { userId, name: label, username: label });
			await ctx.db.patch('users', userId, { profileId });
			return { profileId, userId };
		});
		return { ...ids, caller: t.withIdentity(await sessionFor(t, ids.userId)) };
	};
	const owner = await createUser('owner');
	const visitor = await createUser('visitor');
	const moderator = await createUser('moderator');
	const organizationId = await owner.caller.mutation(api.organizations.create, {
		name: 'Acme',
		slug: 'acme',
	});
	const projectId = await owner.caller.mutation(api.policy.createProject, {
		organizationId,
		name: 'Product',
		slug: 'product',
	});
	await owner.caller.mutation(api.policy.updateProject, { projectId, visibility: 'public' });
	const invitationId = await owner.caller.mutation(api.invitations.create, {
		organizationId,
		email: 'moderator@example.test',
		role: 'moderator',
		projectIds: [projectId],
	});
	await moderator.caller.mutation(api.invitations.accept, { invitationId });
	const categories = await owner.caller.query(api.forumCategories.list, { projectId });
	const category = (slug: string) => {
		const found = categories?.find((row) => row.slug === slug);
		if (!found) throw new Error(`missing category ${slug}`);
		return found.id;
	};
	const boards = await t.query(api.feedbackBoards.list, { projectId });
	// Filed by a visitor as feedback, though it's really a question.
	const feedback = await visitor.caller.mutation(api.feedback.create, {
		projectId,
		boardId: boards![0]!.id,
		title: 'How do I export to CSV?',
		firstComment: '<p>Is there a <strong>CSV</strong> export?</p>',
	});
	return {
		t,
		owner,
		visitor,
		moderator,
		projectId,
		feedback,
		qa: category('q-a'),
		announcements: category('announcements'),
	};
}

const page = { cursor: null, numItems: 20 };

describe('moving feedback to the forum', () => {
	test('only content managers move feedback', async () => {
		const s = await fixture();
		// Not even the feedback's author may move it.
		await expect(
			s.visitor.caller.mutation(api.forumMoves.moveFromFeedback, {
				feedbackId: s.feedback.feedbackId,
				categoryId: s.qa,
			})
		).rejects.toThrow('FORBIDDEN');
		const { topicSlug } = await s.moderator.caller.mutation(api.forumMoves.moveFromFeedback, {
			feedbackId: s.feedback.feedbackId,
			categoryId: s.qa,
		});
		expect(topicSlug).toBeTruthy();
	});

	test('rejects moves while the forum is turned off', async () => {
		const s = await fixture();
		await s.t.run((ctx) => ctx.db.patch('projects', s.projectId, { forumEnabled: false }));
		await expect(
			s.owner.caller.mutation(api.forumMoves.moveFromFeedback, {
				feedbackId: s.feedback.feedbackId,
				categoryId: s.qa,
			})
		).rejects.toThrow('FORUM_DISABLED');
	});

	test('rejects a category that is being deleted', async () => {
		const s = await fixture();
		await s.t.run((ctx) => ctx.db.patch('forumCategories', s.qa, { deletingAt: Date.now() }));
		await expect(
			s.owner.caller.mutation(api.forumMoves.moveFromFeedback, {
				feedbackId: s.feedback.feedbackId,
				categoryId: s.qa,
			})
		).rejects.toThrow('INVALID_CATEGORY');
	});

	test('creates a linked topic from the opening post, credited to the author', async () => {
		const s = await fixture();
		// Managers may use team-only categories.
		const { topicSlug } = await s.owner.caller.mutation(api.forumMoves.moveFromFeedback, {
			feedbackId: s.feedback.feedbackId,
			categoryId: s.announcements,
		});
		const detail = await s.t.query(api.forum.detail, {
			projectId: s.projectId,
			slug: topicSlug,
		});
		expect(detail).toMatchObject({
			topic: { title: 'How do I export to CSV?', commentCount: 0, locked: false },
			category: { id: s.announcements },
			author: { username: 'visitor' },
			firstComment: { content: '<p>Is there a <strong>CSV</strong> export?</p>' },
			links: [{ kind: 'feedback', slug: s.feedback.slug, status: 'closed' }],
			events: [
				{
					eventType: 'imported_from_feedback',
					actor: { username: 'owner' },
					feedback: { slug: s.feedback.slug, title: 'How do I export to CSV?' },
				},
			],
		});
		// The topic is searchable and the author follows it, like any new topic.
		const search = await s.t.query(api.forum.list, {
			projectId: s.projectId,
			search: 'CSV',
			paginationOpts: page,
		});
		expect(search.page.map((item) => item.slug)).toEqual([topicSlug]);
		const following = await s.visitor.caller.query(api.forum.list, {
			projectId: s.projectId,
			filter: 'following',
			paginationOpts: page,
		});
		expect(following.page.map((item) => item.slug)).toEqual([topicSlug]);
	});

	test('closes the feedback and records both events', async () => {
		const s = await fixture();
		const { topicSlug } = await s.owner.caller.mutation(api.forumMoves.moveFromFeedback, {
			feedbackId: s.feedback.feedbackId,
			categoryId: s.qa,
		});
		const topic = await s.t.query(api.forum.detail, { projectId: s.projectId, slug: topicSlug });
		const stored = await s.t.run((ctx) => ctx.db.get('feedback', s.feedback.feedbackId));
		expect(stored).toMatchObject({ status: 'closed', movedToTopicId: topic!.topic.id });
		const detail = await s.t.query(api.feedback.getDetail, {
			projectId: s.projectId,
			slug: s.feedback.slug,
		});
		expect(detail?.movedTo).toEqual({ slug: topicSlug, title: 'How do I export to CSV?' });
		expect(detail?.timeline).toMatchObject([
			{
				type: 'event',
				data: {
					eventType: 'moved_to_forum',
					actor: { username: 'owner' },
					metadata: { topicId: topic!.topic.id, newValue: 'How do I export to CSV?' },
					topic: { slug: topicSlug, title: 'How do I export to CSV?' },
				},
			},
			{
				type: 'event',
				data: {
					eventType: 'status_changed',
					metadata: { oldValue: 'open', newValue: 'closed' },
				},
			},
		]);

		// Once the topic is deleted the event keeps its saved title, unlinked.
		await s.owner.caller.mutation(api.forum.remove, { topicId: topic!.topic.id });
		const after = await s.t.query(api.feedback.getDetail, {
			projectId: s.projectId,
			slug: s.feedback.slug,
		});
		expect(after?.movedTo).toBeNull();
		expect(after?.timeline[0]).toMatchObject({
			data: {
				eventType: 'moved_to_forum',
				topic: null,
				metadata: { newValue: 'How do I export to CSV?' },
			},
		});
	});

	test('already closed feedback records no status change', async () => {
		const s = await fixture();
		await s.owner.caller.mutation(api.feedback.updateStatus, {
			feedbackId: s.feedback.feedbackId,
			status: 'closed',
		});
		await s.owner.caller.mutation(api.forumMoves.moveFromFeedback, {
			feedbackId: s.feedback.feedbackId,
			categoryId: s.qa,
		});
		const timeline = await s.t.query(api.feedback.listTimelinePage, {
			feedbackId: s.feedback.feedbackId,
			paginationOpts: page,
		});
		expect(timeline?.page.map((item) => item.type === 'event' && item.data.eventType)).toEqual([
			'status_changed',
			'moved_to_forum',
		]);
	});

	test('rejects moving the same feedback twice', async () => {
		const s = await fixture();
		await s.owner.caller.mutation(api.forumMoves.moveFromFeedback, {
			feedbackId: s.feedback.feedbackId,
			categoryId: s.qa,
		});
		await expect(
			s.owner.caller.mutation(api.forumMoves.moveFromFeedback, {
				feedbackId: s.feedback.feedbackId,
				categoryId: s.qa,
			})
		).rejects.toThrow('ALREADY_MOVED');
		const topics = await s.t.run((ctx) =>
			ctx.db
				.query('forumTopics')
				.withIndex('by_projectId', (q) => q.eq('projectId', s.projectId))
				.take(10)
		);
		expect(topics).toHaveLength(1);
	});
});
