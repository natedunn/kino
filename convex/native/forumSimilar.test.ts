// @vitest-environment edge-runtime
import { registerCore } from '@convex-dev/auth/test';
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { configureTestAuth, sessionFor } from '../testing/setup.testing';
import { api } from './_generated/api';
import { searchQuery } from './forumSimilar';
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
	// The default plan allows one organization per user and one project per
	// organization, so the second project gets its own owner.
	const createProject = async (creator: typeof owner, slug: string) => {
		const organizationId = await creator.caller.mutation(api.organizations.create, {
			name: slug,
			slug: `${slug}-org`,
		});
		const projectId = await creator.caller.mutation(api.policy.createProject, {
			organizationId,
			name: slug,
			slug,
		});
		await creator.caller.mutation(api.policy.updateProject, { projectId, visibility: 'public' });
		const categories = await creator.caller.query(api.forumCategories.list, { projectId });
		const general = categories?.find((row) => row.slug === 'general')?.id;
		const boards = await creator.caller.query(api.feedbackBoards.list, { projectId });
		const boardId = boards?.[0]?.id;
		if (!general || !boardId) throw new Error('missing project defaults');
		return { projectId, general, boardId };
	};
	const product = await createProject(owner, 'product');
	const other = await createProject(await createUser('elsewhere'), 'other');
	const topic = (project: typeof product, title: string) =>
		visitor.caller.mutation(api.forum.create, {
			projectId: project.projectId,
			categoryId: project.general,
			title,
			body: '<p>Body</p>',
		});
	const feedback = (project: typeof product, title: string) =>
		visitor.caller.mutation(api.feedback.create, {
			projectId: project.projectId,
			boardId: project.boardId,
			title,
			firstComment: '<p>Details</p>',
		});
	return { t, owner, visitor, product, other, topic, feedback };
}

describe('forum similar content', () => {
	test('builds search queries from words in any script', () => {
		expect(searchQuery('  How do I export (CSV) data?! ')).toBe('How do I export CSV data');
		expect(searchQuery('导出 数据')).toBe('导出 数据');
		expect(searchQuery('?!…')).toBe('');
		expect(
			searchQuery(Array.from({ length: 30 }, (_, i) => `w${i}`).join(' ')).split(' ')
		).toHaveLength(16);
	});

	test('similar topics exclude the topic itself, deleted topics and other projects', async () => {
		const s = await fixture();
		const source = await s.topic(s.product, 'Export data to CSV');
		const sibling = await s.topic(s.product, 'CSV export is slow');
		const doomed = await s.topic(s.product, 'Export to CSV fails');
		await s.topic(s.product, 'Dark mode please');
		await s.topic(s.other, 'Export CSV in the other project');
		await s.owner.caller.mutation(api.forum.remove, { topicId: doomed.id });

		const similar = await s.t.query(api.forumSimilar.similarTopics, { topicId: source.id });
		expect(similar.map((row) => row.id)).toEqual([sibling.id]);
		expect(similar[0]).toMatchObject({
			slug: sibling.slug,
			title: 'CSV export is slow',
			commentCount: 0,
			category: { name: 'General', format: 'open' },
		});
		// A deleting topic has no similar topics of its own.
		expect(await s.t.query(api.forumSimilar.similarTopics, { topicId: doomed.id })).toEqual([]);
	});

	test('returns nothing when the forum is disabled', async () => {
		const s = await fixture();
		const source = await s.topic(s.product, 'Export data to CSV');
		await s.topic(s.product, 'CSV export is slow');
		await s.feedback(s.product, 'Add CSV export');
		await s.owner.caller.mutation(api.settings.updateProject, {
			id: s.product.projectId,
			name: 'product',
			slug: 'product',
			description: '',
			visibility: 'public',
			updatesFeaturedMode: 'latest',
			urls: [],
			forumEnabled: false,
		});
		expect(await s.t.query(api.forumSimilar.similarTopics, { topicId: source.id })).toEqual([]);
		expect(
			await s.visitor.caller.query(api.forumSimilar.suggestions, {
				projectId: s.product.projectId,
				title: 'CSV export',
			})
		).toEqual({ topics: [], feedback: [] });
	});

	test('private projects hide similar content from non-members', async () => {
		const s = await fixture();
		const source = await s.topic(s.product, 'Export data to CSV');
		const sibling = await s.topic(s.product, 'CSV export is slow');
		await s.feedback(s.product, 'Add CSV export');
		await s.owner.caller.mutation(api.policy.updateProject, {
			projectId: s.product.projectId,
			visibility: 'private',
		});
		const args = { projectId: s.product.projectId, title: 'CSV export' };
		expect(await s.t.query(api.forumSimilar.similarTopics, { topicId: source.id })).toEqual([]);
		expect(
			await s.visitor.caller.query(api.forumSimilar.similarTopics, { topicId: source.id })
		).toEqual([]);
		expect(await s.visitor.caller.query(api.forumSimilar.suggestions, args)).toEqual({
			topics: [],
			feedback: [],
		});
		// Members still see them.
		expect(
			(await s.owner.caller.query(api.forumSimilar.similarTopics, { topicId: source.id })).map(
				(row) => row.id
			)
		).toEqual([sibling.id]);
		const owned = await s.owner.caller.query(api.forumSimilar.suggestions, args);
		expect(owned.topics).toHaveLength(2);
		expect(owned.feedback).toHaveLength(1);
	});

	test('suggestions return matching topics and live feedback from the project', async () => {
		const s = await fixture();
		const topic = await s.topic(s.product, 'Export data to CSV');
		await s.topic(s.product, 'Dark mode please');
		await s.topic(s.other, 'CSV export elsewhere');
		const request = await s.feedback(s.product, 'Add CSV export');
		await s.feedback(s.product, 'Keyboard shortcuts');
		await s.feedback(s.other, 'CSV export for other');
		const removed = await s.feedback(s.product, 'CSV export via API');
		await s.owner.caller.mutation(api.feedback.remove, { feedbackId: removed.feedbackId });
		const moved = await s.feedback(s.product, 'Export CSV moved');
		const categories = await s.owner.caller.query(api.forumCategories.list, {
			projectId: s.product.projectId,
		});
		const movedTopic = await s.owner.caller.mutation(api.forumMoves.moveFromFeedback, {
			feedbackId: moved.feedbackId,
			categoryId: categories![0]!.id,
		});

		// Signed-out visitors of a public project can read suggestions too.
		const result = await s.t.query(api.forumSimilar.suggestions, {
			projectId: s.product.projectId,
			title: '  CSV export?  ',
		});
		expect(new Set(result.topics.map((row) => row.id))).toEqual(
			new Set([
				topic.id,
				...(await s.t.run(async (ctx) =>
					(await ctx.db.query('forumTopics').collect())
						.filter((row) => row.slug === movedTopic.topicSlug)
						.map((row) => row._id)
				)),
			])
		);
		expect(result.feedback).toEqual([
			{ id: request.feedbackId, slug: request.slug, title: 'Add CSV export', status: 'open' },
		]);

		expect(
			await s.t.query(api.forumSimilar.suggestions, {
				projectId: s.product.projectId,
				title: ' ?! ',
			})
		).toEqual({ topics: [], feedback: [] });
		await expect(
			s.t.query(api.forumSimilar.suggestions, {
				projectId: s.product.projectId,
				title: 'x'.repeat(101),
			})
		).rejects.toThrow('INVALID_SEARCH');
	});

	test('caps each list at five results', async () => {
		const s = await fixture();
		for (let index = 0; index < 7; index += 1) {
			await s.topic(s.product, `Export option ${index}`);
			await s.feedback(s.product, `Export request ${index}`);
		}
		const result = await s.t.query(api.forumSimilar.suggestions, {
			projectId: s.product.projectId,
			title: 'Export',
		});
		expect(result.topics).toHaveLength(5);
		expect(result.feedback).toHaveLength(5);
	});
});
