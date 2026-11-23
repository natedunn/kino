// @vitest-environment edge-runtime
import type { Id } from './_generated/dataModel';

import { registerCore } from '@convex-dev/auth/test';
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { configureTestAuth, sessionFor } from '../testing/setup.testing';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.testing.ts']);

const DAY = 24 * 60 * 60 * 1000;
const page = { cursor: null, numItems: 20 };

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
	const categories = await owner.caller.query(api.forumCategories.list, { projectId });
	const category = (slug: string) => {
		const found = categories?.find((row) => row.slug === slug);
		if (!found) throw new Error(`missing category ${slug}`);
		return found.id;
	};
	const general = category('general');
	const create = async (
		title: string,
		categoryId: Id<'forumCategories'> = general,
		caller = visitor.caller
	) =>
		caller.mutation(api.forum.create, {
			projectId,
			categoryId,
			title,
			body: `<p>${title}</p>`,
		});
	const topic = (id: Id<'forumTopics'>) => t.run((ctx) => ctx.db.get('forumTopics', id));
	const counts = async () =>
		Object.fromEntries(
			(await t.query(api.forumStats.overview, { projectId }))!.map((row) => [
				row.slug,
				row.topicCount,
			])
		);
	return {
		t,
		owner,
		visitor,
		projectId,
		general,
		qa: category('q-a'),
		ideas: category('ideas'),
		create,
		topic,
		counts,
	};
}

describe('forum topic score', () => {
	test('counts replies and opening-post reactions, not reactions on replies', async () => {
		const s = await fixture();
		const created = await s.create('Dark mode?');
		expect((await s.topic(created.id))?.score).toBe(0);

		const reply = await s.owner.caller.mutation(api.forum.addComment, {
			topicId: created.id,
			content: '<p>Soon.</p>',
		});
		await s.visitor.caller.mutation(api.forum.addComment, {
			topicId: created.id,
			content: '<p>Thanks!</p>',
		});
		expect((await s.topic(created.id))?.score).toBe(2);

		const firstCommentId = (await s.topic(created.id))!.firstCommentId!;
		await s.owner.caller.mutation(api.forum.toggleReaction, {
			commentId: firstCommentId,
			content: 'heart',
		});
		await s.owner.caller.mutation(api.forum.toggleReaction, {
			commentId: firstCommentId,
			content: 'thumbsUp',
		});
		expect((await s.topic(created.id))?.score).toBe(4);
		// Toggling off takes the point back.
		await s.owner.caller.mutation(api.forum.toggleReaction, {
			commentId: firstCommentId,
			content: 'heart',
		});
		expect((await s.topic(created.id))?.score).toBe(3);

		// Reactions on replies praise the reply, not the topic.
		await s.visitor.caller.mutation(api.forum.toggleReaction, {
			commentId: reply,
			content: 'heart',
		});
		expect((await s.topic(created.id))?.score).toBe(3);

		// Moderation deletes take the reply's point away.
		await s.owner.caller.mutation(api.forum.removeComment, { commentId: reply });
		await s.t.finishAllScheduledFunctions(vi.runAllTimers);
		expect((await s.topic(created.id))?.score).toBe(2);
	});

	test('counts poll voters once, however often they change their vote', async () => {
		const s = await fixture();
		const created = await s.visitor.caller.mutation(api.forum.create, {
			projectId: s.projectId,
			categoryId: s.general,
			title: 'Theme?',
			body: '<p>Pick one.</p>',
			poll: { options: ['Light', 'Dark'], multiple: false },
		});
		const poll = (await s.t.query(api.forumPolls.get, { topicId: created.id }))!;
		const [light, dark] = poll.options.map((option) => option.id);
		await s.owner.caller.mutation(api.forumPolls.vote, { pollId: poll.id, optionIds: [light] });
		await s.visitor.caller.mutation(api.forumPolls.vote, { pollId: poll.id, optionIds: [dark] });
		expect((await s.topic(created.id))?.score).toBe(2);
		await s.owner.caller.mutation(api.forumPolls.vote, { pollId: poll.id, optionIds: [dark] });
		expect((await s.topic(created.id))?.score).toBe(2);
		await s.owner.caller.mutation(api.forumPolls.vote, { pollId: poll.id, optionIds: [] });
		expect((await s.topic(created.id))?.score).toBe(1);
	});

	test('backfill scores existing topics and counts category topics', async () => {
		const s = await fixture();
		const created = await s.create('Older topic');
		await s.owner.caller.mutation(api.forum.addComment, {
			topicId: created.id,
			content: '<p>Reply</p>',
		});
		const firstCommentId = (await s.topic(created.id))!.firstCommentId!;
		await s.owner.caller.mutation(api.forum.toggleReaction, {
			commentId: firstCommentId,
			content: 'heart',
		});
		await s.create('Another', s.qa);
		// As if written before the fields existed.
		await s.t.run(async (ctx) => {
			for (const row of await ctx.db.query('forumTopics').collect())
				await ctx.db.patch('forumTopics', row._id, { score: undefined });
			for (const row of await ctx.db.query('forumCategories').collect())
				await ctx.db.patch('forumCategories', row._id, { topicCount: undefined });
		});
		expect(await s.counts()).toMatchObject({ general: 0, 'q-a': 0 });

		await s.t.mutation(internal.forumStats.backfill, {});
		await s.t.finishAllScheduledFunctions(vi.runAllTimers);
		expect((await s.topic(created.id))?.score).toBe(2);
		expect(await s.counts()).toMatchObject({ general: 1, 'q-a': 1, ideas: 0 });
	});
});

describe('forum Top view', () => {
	test('ranks by score within the chosen period', async () => {
		const s = await fixture();
		const start = Date.now();
		const old = await s.create('Old favourite');
		for (const content of ['<p>a</p>', '<p>b</p>', '<p>c</p>'])
			await s.owner.caller.mutation(api.forum.addComment, { topicId: old.id, content });

		vi.setSystemTime(start + 60 * DAY);
		await s.create('Quiet newcomer');
		const busy = await s.create('Busy newcomer', s.qa);
		await s.owner.caller.mutation(api.forum.addComment, {
			topicId: busy.id,
			content: '<p>Reply</p>',
		});

		const top = async (args: { since?: number; categoryId?: Id<'forumCategories'> }) =>
			(
				await s.t.query(api.forum.list, {
					projectId: s.projectId,
					sort: 'top',
					paginationOpts: page,
					...args,
				})
			).page.map((item) => item.title);

		expect(await top({})).toEqual(['Old favourite', 'Busy newcomer', 'Quiet newcomer']);
		// Last month: the old topic falls outside the window.
		expect(await top({ since: start + 30 * DAY })).toEqual(['Busy newcomer', 'Quiet newcomer']);
		expect(await top({ since: start + 30 * DAY, categoryId: s.general })).toEqual([
			'Quiet newcomer',
		]);
		expect(await top({ categoryId: s.general })).toEqual(['Old favourite', 'Quiet newcomer']);
		expect(
			(
				await s.t.query(api.forum.list, {
					projectId: s.projectId,
					sort: 'top',
					paginationOpts: page,
				})
			).page[0]
		).toMatchObject({ id: old.id, score: 3 });
		// The window only applies to Top.
		expect(
			(
				await s.t.query(api.forum.list, {
					projectId: s.projectId,
					since: start + 30 * DAY,
					paginationOpts: page,
				})
			).page
		).toHaveLength(3);
	});

	test('bounds the rows a windowed page reads', async () => {
		const s = await fixture();
		const start = Date.now();
		for (const title of ['One', 'Two', 'Three', 'Four']) {
			const created = await s.create(title);
			await s.owner.caller.mutation(api.forum.addComment, {
				topicId: created.id,
				content: '<p>Reply</p>',
			});
		}
		vi.setSystemTime(start + 60 * DAY);
		await s.create('Recent');
		const result = await s.t.query(api.forum.list, {
			projectId: s.projectId,
			sort: 'top',
			since: start + 30 * DAY,
			paginationOpts: { ...page, maximumRowsRead: 2 },
		});
		// Only older, higher-scored topics fit the budget; the page asks to split.
		expect(result.page).toEqual([]);
		expect(result.isDone).toBe(false);
		expect(result.pageStatus).toBe('SplitRequired');
	});
});

describe('forum category stats', () => {
	test('topic counts follow topics as they are created, moved and deleted', async () => {
		const s = await fixture();
		const first = await s.create('First');
		const second = await s.create('Second');
		expect(await s.counts()).toMatchObject({ general: 2, 'q-a': 0, ideas: 0 });

		await s.visitor.caller.mutation(api.forum.setCategory, {
			topicId: second.id,
			categoryId: s.qa,
		});
		expect(await s.counts()).toMatchObject({ general: 1, 'q-a': 1 });

		// Feedback moved into the forum lands in a category like any new topic.
		const boards = await s.t.query(api.feedbackBoards.list, { projectId: s.projectId });
		const feedback = await s.visitor.caller.mutation(api.feedback.create, {
			projectId: s.projectId,
			boardId: boards![0]!.id,
			title: 'A question',
			firstComment: '<p>How?</p>',
		});
		await s.owner.caller.mutation(api.forumMoves.moveFromFeedback, {
			feedbackId: feedback.feedbackId,
			categoryId: s.ideas,
		});
		expect(await s.counts()).toMatchObject({ general: 1, 'q-a': 1, ideas: 1 });

		await s.owner.caller.mutation(api.forum.remove, { topicId: second.id });
		expect(await s.counts()).toMatchObject({ 'q-a': 0 });
		await s.t.finishAllScheduledFunctions(vi.runAllTimers);
		expect(await s.counts()).toMatchObject({ general: 1, 'q-a': 0, ideas: 1 });

		// Deleting a category moves its topics, and their count, to another.
		await s.owner.caller.mutation(api.forumCategories.remove, {
			categoryId: s.general,
			moveToCategoryId: s.ideas,
		});
		await s.t.finishAllScheduledFunctions(vi.runAllTimers);
		const counts = await s.counts();
		expect(counts).toMatchObject({ ideas: 2 });
		expect(counts).not.toHaveProperty('general');
		expect((await s.topic(first.id))?.categoryId).toBe(s.ideas);
	});

	test('overview lists categories with their most recently active topic', async () => {
		const s = await fixture();
		const older = await s.create('Older');
		vi.advanceTimersByTime(DAY);
		const newer = await s.create('Newer');
		vi.advanceTimersByTime(DAY);

		const overview = async () =>
			(await s.t.query(api.forumStats.overview, { projectId: s.projectId }))!;
		const general = async () => (await overview()).find((row) => row.slug === 'general');
		expect((await overview()).map((row) => row.slug)).toEqual([
			'general',
			'q-a',
			'ideas',
			'show-and-tell',
			'announcements',
		]);
		expect(await general()).toMatchObject({
			name: 'General',
			icon: 'chat',
			topicCount: 2,
			latest: { id: newer.id, title: 'Newer', slug: newer.slug },
		});
		expect((await overview()).find((row) => row.slug === 'q-a')).toMatchObject({
			topicCount: 0,
			latest: null,
		});

		// A reply makes the older topic the latest again.
		await s.owner.caller.mutation(api.forum.addComment, {
			topicId: older.id,
			content: '<p>Bump</p>',
		});
		expect((await general())?.latest).toMatchObject({ id: older.id, lastActivityAt: Date.now() });

		// Topics being deleted are skipped.
		await s.owner.caller.mutation(api.forum.remove, { topicId: older.id });
		expect(await general()).toMatchObject({ topicCount: 1, latest: { id: newer.id } });
	});

	test('overview is hidden when the forum is off', async () => {
		const s = await fixture();
		await s.t.run((ctx) => ctx.db.patch('projects', s.projectId, { forumEnabled: false }));
		expect(await s.t.query(api.forumStats.overview, { projectId: s.projectId })).toBeNull();
	});
});
