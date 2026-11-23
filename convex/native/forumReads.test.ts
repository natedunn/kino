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
	const author = await createUser('author');
	const reader = await createUser('reader');
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
	const createTopic = (title: string) =>
		author.caller.mutation(api.forum.create, {
			projectId,
			categoryId: general,
			title,
			body: '<p>Body</p>',
		});
	const reply = async (topicId: Awaited<ReturnType<typeof createTopic>>['id']) => {
		vi.advanceTimersByTime(1000);
		return author.caller.mutation(api.forum.addComment, { topicId, content: '<p>Reply</p>' });
	};
	return { t, owner, author, reader, projectId, createTopic, reply };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

const page = { cursor: null, numItems: 20 };

async function unreadFor(s: Fixture, caller: Fixture['reader']['caller'] | Fixture['t']) {
	const list = await caller.query(api.forum.list, { projectId: s.projectId, paginationOpts: page });
	return Object.fromEntries(list.page.map((item) => [item.title, item.unread]));
}

describe('forum unread tracking', () => {
	test('topics are new until opened, then show new replies', async () => {
		const s = await fixture();
		const { id } = await s.createTopic('Topic');

		expect(await unreadFor(s, s.t)).toEqual({ Topic: null });
		// Authors have read their own topic.
		expect(await unreadFor(s, s.author.caller)).toEqual({
			Topic: { state: 'read', newReplies: 0 },
		});
		expect(await unreadFor(s, s.reader.caller)).toEqual({ Topic: { state: 'new', newReplies: 0 } });

		await s.reader.caller.mutation(api.forumReads.markRead, { topicId: id });
		expect(await unreadFor(s, s.reader.caller)).toEqual({
			Topic: { state: 'read', newReplies: 0 },
		});

		await s.reply(id);
		await s.reply(id);
		expect(await unreadFor(s, s.reader.caller)).toEqual({
			Topic: { state: 'replies', newReplies: 2 },
		});
		// Repliers have read the thread up to their own reply.
		expect(await unreadFor(s, s.author.caller)).toEqual({
			Topic: { state: 'read', newReplies: 0 },
		});

		await s.reader.caller.mutation(api.forumReads.markRead, { topicId: id });
		expect(await unreadFor(s, s.reader.caller)).toEqual({
			Topic: { state: 'read', newReplies: 0 },
		});
	});

	test('pinned topics carry unread state too', async () => {
		const s = await fixture();
		const { id } = await s.createTopic('Pinned');
		await s.owner.caller.mutation(api.forum.setPinned, { topicId: id, pinned: true });
		const pinned = await s.reader.caller.query(api.forum.pinned, { projectId: s.projectId });
		expect(pinned.map((item) => item.unread)).toEqual([{ state: 'new', newReplies: 0 }]);
		expect(
			(await s.t.query(api.forum.pinned, { projectId: s.projectId })).map((item) => item.unread)
		).toEqual([null]);
	});

	test('deleted replies never read as unread', async () => {
		const s = await fixture();
		const { id } = await s.createTopic('Topic');
		const first = await s.reply(id);
		await s.reply(id);
		await s.reader.caller.mutation(api.forumReads.markRead, { topicId: id });
		await s.author.caller.mutation(api.forum.removeComment, { commentId: first });
		expect(await unreadFor(s, s.reader.caller)).toEqual({
			Topic: { state: 'read', newReplies: 0 },
		});
		await s.reply(id);
		expect(await unreadFor(s, s.reader.caller)).toEqual({
			Topic: { state: 'replies', newReplies: 1 },
		});
	});

	test('mark all as read settles everything up to now', async () => {
		const s = await fixture();
		const opened = await s.createTopic('Opened');
		await s.createTopic('Unopened');
		await s.reader.caller.mutation(api.forumReads.markRead, { topicId: opened.id });
		await s.reply(opened.id);

		vi.advanceTimersByTime(1000);
		await s.reader.caller.mutation(api.forumReads.markAllRead, { projectId: s.projectId });
		expect(await unreadFor(s, s.reader.caller)).toEqual({
			Opened: { state: 'read', newReplies: 0 },
			Unopened: { state: 'read', newReplies: 0 },
		});
		// The divider boundary moves up to the marker.
		const marker = await s.t.run((ctx) => ctx.db.query('forumReadMarkers').first());
		expect(
			await s.reader.caller.query(api.forumReads.topicState, { topicId: opened.id })
		).toMatchObject({ unread: false, lastReadAt: marker?.readAllAt });

		// Activity after the marker counts again.
		vi.advanceTimersByTime(1000);
		const third = await s.createTopic('Later');
		await s.reply(opened.id);
		expect(await unreadFor(s, s.reader.caller)).toMatchObject({
			Opened: { state: 'replies' },
			Later: { state: 'new', newReplies: 0 },
		});
		await s.reader.caller.mutation(api.forumReads.markRead, { topicId: third.id });
		expect((await unreadFor(s, s.reader.caller)).Later).toEqual({ state: 'read', newReplies: 0 });
	});

	test('topic state gives the previous read and skips redundant writes', async () => {
		const s = await fixture();
		const { id } = await s.createTopic('Topic');
		expect(await s.t.query(api.forumReads.topicState, { topicId: id })).toBeNull();
		expect(await s.reader.caller.query(api.forumReads.topicState, { topicId: id })).toEqual({
			lastReadAt: null,
			unread: true,
			upToDate: false,
		});

		await s.reader.caller.mutation(api.forumReads.markRead, { topicId: id });
		const storedRead = () =>
			s.t.run(async (ctx) => {
				const rows = await ctx.db.query('forumReads').collect();
				return rows.find((row) => row.profileId === s.reader.profileId)?.lastReadAt;
			});
		const readAt = await storedRead();
		vi.advanceTimersByTime(5000);
		// Nothing new: the stored read stays put.
		await s.reader.caller.mutation(api.forumReads.markRead, { topicId: id });
		expect(await s.reader.caller.query(api.forumReads.topicState, { topicId: id })).toEqual({
			lastReadAt: readAt,
			unread: false,
			upToDate: true,
		});

		await s.reply(id);
		expect(await s.reader.caller.query(api.forumReads.topicState, { topicId: id })).toEqual({
			lastReadAt: readAt,
			unread: true,
			upToDate: false,
		});
		await s.reader.caller.mutation(api.forumReads.markRead, { topicId: id });
		const rereadAt = await storedRead();
		expect(rereadAt).toBeGreaterThan(readAt!);
		expect(await s.reader.caller.query(api.forumReads.topicState, { topicId: id })).toEqual({
			lastReadAt: rereadAt,
			unread: false,
			upToDate: true,
		});
		expect(await s.t.run((ctx) => ctx.db.query('forumReads').collect())).toHaveLength(2);
	});

	test('marking read needs a signed-in viewer who can see the topic', async () => {
		const s = await fixture();
		const { id } = await s.createTopic('Topic');
		await expect(s.t.mutation(api.forumReads.markRead, { topicId: id })).rejects.toThrow(
			'UNAUTHORIZED'
		);
		await expect(
			s.t.mutation(api.forumReads.markAllRead, { projectId: s.projectId })
		).rejects.toThrow('UNAUTHORIZED');
		await s.owner.caller.mutation(api.policy.updateProject, {
			projectId: s.projectId,
			visibility: 'private',
		});
		await expect(
			s.reader.caller.mutation(api.forumReads.markRead, { topicId: id })
		).rejects.toThrow('TOPIC_NOT_FOUND');
		await expect(
			s.reader.caller.mutation(api.forumReads.markAllRead, { projectId: s.projectId })
		).rejects.toThrow('PROJECT_NOT_FOUND');
	});

	test('deleting a topic or the project removes read state', async () => {
		const s = await fixture();
		const doomed = await s.createTopic('Doomed');
		const kept = await s.createTopic('Kept');
		await s.reader.caller.mutation(api.forumReads.markRead, { topicId: doomed.id });
		await s.reader.caller.mutation(api.forumReads.markRead, { topicId: kept.id });
		await s.reader.caller.mutation(api.forumReads.markAllRead, { projectId: s.projectId });

		await s.owner.caller.mutation(api.forum.remove, { topicId: doomed.id });
		await s.t.finishAllScheduledFunctions(vi.runAllTimers);
		const reads = await s.t.run((ctx) => ctx.db.query('forumReads').collect());
		expect(reads.map((row) => row.topicId).sort()).toEqual([kept.id, kept.id]);

		await s.owner.caller.mutation(api.projectDeletion.remove, { id: s.projectId });
		await s.t.finishAllScheduledFunctions(vi.runAllTimers);
		expect(await s.t.run((ctx) => ctx.db.query('forumReads').collect())).toHaveLength(0);
		expect(await s.t.run((ctx) => ctx.db.query('forumReadMarkers').collect())).toHaveLength(0);
	});
});
