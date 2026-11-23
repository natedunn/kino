// @vitest-environment edge-runtime
import type { Id } from './_generated/dataModel';

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
	const author = await createUser('author');
	const voter = await createUser('voter');
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
	const general = categories?.find((row) => row.slug === 'general')?.id;
	if (!general) throw new Error('missing category general');
	const createPoll = async (
		poll: { options: Array<string>; multiple: boolean } = {
			options: ['Light', 'Dark', 'System'],
			multiple: false,
		}
	) => {
		const topic = await author.caller.mutation(api.forum.create, {
			projectId,
			categoryId: general,
			title: 'Which theme do you prefer?',
			body: '<p>Pick one.</p>',
			poll,
		});
		const view = await t.query(api.forumPolls.get, { topicId: topic.id });
		if (!view) throw new Error('missing poll');
		const ids = view.options.map((option) => option.id);
		return { topic, poll: view, ids };
	};
	return { t, owner, author, voter, projectId, general, createPoll };
}

function counts(poll: { options: Array<{ votes: number }>; voterCount: number } | null) {
	return { votes: poll?.options.map((option) => option.votes), voters: poll?.voterCount };
}

describe('forum polls', () => {
	test('a poll is created with its topic and validated server-side', async () => {
		const s = await fixture();
		const { topic, poll } = await s.createPoll({
			options: ['  Light ', 'Dark'],
			multiple: true,
		});
		expect(poll).toMatchObject({
			options: [
				{ label: 'Light', votes: 0 },
				{ label: 'Dark', votes: 0 },
			],
			multiple: true,
			voterCount: 0,
			closed: false,
			viewerOptionIds: [],
		});
		const list = await s.t.query(api.forum.list, {
			projectId: s.projectId,
			paginationOpts: { cursor: null, numItems: 20 },
		});
		expect(list.page).toMatchObject([{ id: topic.id, hasPoll: true }]);

		for (const options of [
			['Only one'],
			['', 'Blank'],
			['Same', ' same '],
			['Long', 'x'.repeat(81)],
			Array.from({ length: 11 }, (_, index) => `Option ${index}`),
		])
			await expect(
				s.author.caller.mutation(api.forum.create, {
					projectId: s.projectId,
					categoryId: s.general,
					title: 'Bad poll',
					body: '<p>Body</p>',
					poll: { options, multiple: false },
				})
			).rejects.toThrow('INVALID_POLL');
		// A rejected poll rolls back the whole topic.
		expect(await s.t.run((ctx) => ctx.db.query('forumTopics').collect())).toHaveLength(1);

		const plain = await s.author.caller.mutation(api.forum.create, {
			projectId: s.projectId,
			categoryId: s.general,
			title: 'No poll',
			body: '<p>Body</p>',
		});
		expect(await s.t.query(api.forumPolls.get, { topicId: plain.id })).toBeNull();
	});

	test('single choice takes one option; changing and removing a vote keeps counts right', async () => {
		const s = await fixture();
		const { topic, poll, ids } = await s.createPoll();
		const topicId = topic.id;
		const [light, dark] = ids as [string, string, string];
		await expect(
			s.voter.caller.mutation(api.forumPolls.vote, { pollId: poll.id, optionIds: [light, dark] })
		).rejects.toThrow('INVALID_POLL_VOTE');
		await expect(
			s.voter.caller.mutation(api.forumPolls.vote, { pollId: poll.id, optionIds: ['nope'] })
		).rejects.toThrow('INVALID_POLL_VOTE');

		await s.voter.caller.mutation(api.forumPolls.vote, { pollId: poll.id, optionIds: [light] });
		await s.author.caller.mutation(api.forumPolls.vote, { pollId: poll.id, optionIds: [light] });
		expect(counts(await s.t.query(api.forumPolls.get, { topicId }))).toEqual({
			votes: [2, 0, 0],
			voters: 2,
		});
		expect((await s.voter.caller.query(api.forumPolls.get, { topicId }))?.viewerOptionIds).toEqual([
			light,
		]);

		await s.voter.caller.mutation(api.forumPolls.vote, { pollId: poll.id, optionIds: [dark] });
		expect(counts(await s.t.query(api.forumPolls.get, { topicId }))).toEqual({
			votes: [1, 1, 0],
			voters: 2,
		});
		// Re-sending the same choice is a no-op.
		await s.voter.caller.mutation(api.forumPolls.vote, { pollId: poll.id, optionIds: [dark] });
		await s.voter.caller.mutation(api.forumPolls.vote, { pollId: poll.id, optionIds: [] });
		expect(counts(await s.t.query(api.forumPolls.get, { topicId }))).toEqual({
			votes: [1, 0, 0],
			voters: 1,
		});
		expect((await s.voter.caller.query(api.forumPolls.get, { topicId }))?.viewerOptionIds).toEqual(
			[]
		);
		expect(await s.t.run((ctx) => ctx.db.query('forumPollVotes').collect())).toHaveLength(1);
	});

	test('multiple choice counts each option once per voter', async () => {
		const s = await fixture();
		const { topic, poll, ids } = await s.createPoll({
			options: ['Docs', 'API', 'Mobile'],
			multiple: true,
		});
		const [docs, apiOption, mobile] = ids as [string, string, string];
		await s.voter.caller.mutation(api.forumPolls.vote, {
			pollId: poll.id,
			optionIds: [mobile, docs, docs],
		});
		await s.author.caller.mutation(api.forumPolls.vote, { pollId: poll.id, optionIds: [docs] });
		expect(counts(await s.t.query(api.forumPolls.get, { topicId: topic.id }))).toEqual({
			votes: [2, 0, 1],
			voters: 2,
		});
		// Stored in option order, without duplicates.
		expect(
			(await s.voter.caller.query(api.forumPolls.get, { topicId: topic.id }))?.viewerOptionIds
		).toEqual([docs, mobile]);
		await s.voter.caller.mutation(api.forumPolls.vote, {
			pollId: poll.id,
			optionIds: [apiOption, mobile],
		});
		expect(counts(await s.t.query(api.forumPolls.get, { topicId: topic.id }))).toEqual({
			votes: [1, 1, 1],
			voters: 2,
		});
	});

	test('closed polls and locked topics reject votes', async () => {
		const s = await fixture();
		const { topic, poll, ids } = await s.createPoll();
		await s.author.caller.mutation(api.forumPolls.setClosed, { pollId: poll.id, closed: true });
		expect(await s.voter.caller.query(api.forumPolls.get, { topicId: topic.id })).toMatchObject({
			closed: true,
			canVote: false,
		});
		await expect(
			s.voter.caller.mutation(api.forumPolls.vote, { pollId: poll.id, optionIds: [ids[0]!] })
		).rejects.toThrow('POLL_CLOSED');
		await s.author.caller.mutation(api.forumPolls.setClosed, { pollId: poll.id, closed: false });

		await s.owner.caller.mutation(api.forum.setLocked, { topicId: topic.id, locked: true });
		expect((await s.voter.caller.query(api.forumPolls.get, { topicId: topic.id }))?.canVote).toBe(
			false
		);
		await expect(
			s.voter.caller.mutation(api.forumPolls.vote, { pollId: poll.id, optionIds: [ids[0]!] })
		).rejects.toThrow('TOPIC_LOCKED');
		// Managers can still take part in a locked topic, as with replies.
		await s.owner.caller.mutation(api.forumPolls.vote, { pollId: poll.id, optionIds: [ids[0]!] });
	});

	test('only the topic author and content managers close a poll', async () => {
		const s = await fixture();
		const { topic, poll } = await s.createPoll();
		expect((await s.voter.caller.query(api.forumPolls.get, { topicId: topic.id }))?.canClose).toBe(
			false
		);
		expect((await s.author.caller.query(api.forumPolls.get, { topicId: topic.id }))?.canClose).toBe(
			true
		);
		await expect(
			s.voter.caller.mutation(api.forumPolls.setClosed, { pollId: poll.id, closed: true })
		).rejects.toThrow('FORBIDDEN');
		await s.owner.caller.mutation(api.forumPolls.setClosed, { pollId: poll.id, closed: true });
		expect((await s.t.query(api.forumPolls.get, { topicId: topic.id }))?.closed).toBe(true);
	});

	test('signed-out visitors read results but cannot vote; hidden forums hide polls', async () => {
		const s = await fixture();
		const { topic, poll, ids } = await s.createPoll();
		await s.voter.caller.mutation(api.forumPolls.vote, { pollId: poll.id, optionIds: [ids[1]!] });
		expect(await s.t.query(api.forumPolls.get, { topicId: topic.id })).toMatchObject({
			voterCount: 1,
			viewerOptionIds: [],
			canVote: true,
			canClose: false,
		});
		await expect(
			s.t.mutation(api.forumPolls.vote, { pollId: poll.id, optionIds: [ids[0]!] })
		).rejects.toThrow();

		await s.owner.caller.mutation(api.policy.updateProject, {
			projectId: s.projectId,
			visibility: 'private',
		});
		expect(await s.voter.caller.query(api.forumPolls.get, { topicId: topic.id })).toBeNull();
		await expect(
			s.voter.caller.mutation(api.forumPolls.vote, { pollId: poll.id, optionIds: [ids[0]!] })
		).rejects.toThrow('TOPIC_NOT_FOUND');

		await s.owner.caller.mutation(api.policy.updateProject, {
			projectId: s.projectId,
			visibility: 'archived',
		});
		expect(await s.owner.caller.query(api.forumPolls.get, { topicId: topic.id })).toMatchObject({
			canVote: false,
			canClose: false,
		});
		await expect(
			s.owner.caller.mutation(api.forumPolls.vote, { pollId: poll.id, optionIds: [ids[0]!] })
		).rejects.toThrow('PROJECT_ARCHIVED');
	});

	test('deleting a topic or its project removes polls and votes', async () => {
		const s = await fixture();
		const first = await s.createPoll();
		const second = await s.createPoll();
		for (const { poll, ids } of [first, second])
			await s.voter.caller.mutation(api.forumPolls.vote, { pollId: poll.id, optionIds: [ids[0]!] });
		const rows = (topicId: Id<'forumTopics'>) =>
			s.t.run(async (ctx) => [
				...(await ctx.db
					.query('forumPolls')
					.withIndex('by_topicId', (q) => q.eq('topicId', topicId))
					.collect()),
				...(await ctx.db
					.query('forumPollVotes')
					.withIndex('by_topicId', (q) => q.eq('topicId', topicId))
					.collect()),
			]);

		await s.owner.caller.mutation(api.forum.remove, { topicId: first.topic.id });
		expect(await s.t.query(api.forumPolls.get, { topicId: first.topic.id })).toBeNull();
		await s.t.finishAllScheduledFunctions(vi.runAllTimers);
		expect(await rows(first.topic.id)).toHaveLength(0);
		expect(await rows(second.topic.id)).toHaveLength(2);

		await s.owner.caller.mutation(api.projectDeletion.remove, { id: s.projectId });
		await s.t.finishAllScheduledFunctions(vi.runAllTimers);
		expect(await s.t.run((ctx) => ctx.db.query('forumPolls').collect())).toHaveLength(0);
		expect(await s.t.run((ctx) => ctx.db.query('forumPollVotes').collect())).toHaveLength(0);
	});
});
