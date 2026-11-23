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
	const general = categories?.find((row) => row.slug === 'general')?.id;
	if (!general) throw new Error('missing general category');
	const topic = (title: string) =>
		visitor.caller.mutation(api.forum.create, {
			projectId,
			categoryId: general,
			title,
			body: `<p>${title}</p>`,
		});
	return { t, owner, visitor, moderator, projectId, topic };
}

const page = { cursor: null, numItems: 20 };

describe('forum replies', () => {
	test('reply-to targets a live reply in the same topic, never the opening post', async () => {
		const s = await fixture();
		const topic = await s.topic('Exports');
		const other = await s.topic('Imports');
		const detail = await s.t.query(api.forum.detail, { projectId: s.projectId, slug: topic.slug });
		const openingPost = detail!.firstComment!.id;
		const otherReply = await s.owner.caller.mutation(api.forum.addComment, {
			topicId: other.id,
			content: '<p>Elsewhere</p>',
		});
		const first = await s.owner.caller.mutation(api.forum.addComment, {
			topicId: topic.id,
			content: '<p>Use the CSV export.</p>',
		});

		await expect(
			s.visitor.caller.mutation(api.forum.addComment, {
				topicId: topic.id,
				content: '<p>Replying to the post</p>',
				replyToCommentId: openingPost,
			})
		).rejects.toThrow('INVALID_REPLY');
		await expect(
			s.visitor.caller.mutation(api.forum.addComment, {
				topicId: topic.id,
				content: '<p>Wrong topic</p>',
				replyToCommentId: otherReply,
			})
		).rejects.toThrow('INVALID_REPLY');

		const answer = await s.visitor.caller.mutation(api.forum.addComment, {
			topicId: topic.id,
			content: '<p>Thanks!</p>',
			replyToCommentId: first,
		});
		const replies = await s.t.query(api.forum.replies, { topicId: topic.id, paginationOpts: page });
		expect(replies.page).toMatchObject([
			{ id: first, replyTo: null },
			{ id: answer, replyTo: { id: first, author: { username: 'owner' } } },
		]);

		// A deleted target can't be replied to.
		await s.owner.caller.mutation(api.forum.removeComment, { commentId: first });
		await expect(
			s.visitor.caller.mutation(api.forum.addComment, {
				topicId: topic.id,
				content: '<p>Too late</p>',
				replyToCommentId: first,
			})
		).rejects.toThrow('INVALID_REPLY');
	});

	test('deleting a comment clears the link on its replies', async () => {
		const s = await fixture();
		const topic = await s.topic('Exports');
		const first = await s.owner.caller.mutation(api.forum.addComment, {
			topicId: topic.id,
			content: '<p>Use the CSV export.</p>',
		});
		const reply = await s.visitor.caller.mutation(api.forum.addComment, {
			topicId: topic.id,
			content: '<p>Thanks!</p>',
			replyToCommentId: first,
		});

		await s.owner.caller.mutation(api.forum.removeComment, { commentId: first });
		// The link reads as gone before the cleanup runs.
		const before = await s.t.query(api.forum.replies, { topicId: topic.id, paginationOpts: page });
		expect(before.page).toMatchObject([{ id: reply, replyTo: null }]);

		await s.t.finishAllScheduledFunctions(vi.runAllTimers);
		const stored = await s.t.run((ctx) => ctx.db.get('forumComments', reply));
		expect(stored?.replyToCommentId).toBeUndefined();
		expect(stored?.content).toBe('<p>Thanks!</p>');
	});

	test('flags organization members as Team on the opening post and replies', async () => {
		const s = await fixture();
		const topic = await s.topic('Exports');
		for (const author of [s.owner, s.moderator, s.visitor])
			await author.caller.mutation(api.forum.addComment, {
				topicId: topic.id,
				content: '<p>Reply</p>',
			});

		const detail = await s.t.query(api.forum.detail, { projectId: s.projectId, slug: topic.slug });
		expect(detail?.firstComment).toMatchObject({
			author: { username: 'visitor' },
			isTeamMember: false,
		});
		const replies = await s.t.query(api.forum.replies, { topicId: topic.id, paginationOpts: page });
		expect(replies.page.map((reply) => [reply.author?.username, reply.isTeamMember])).toEqual([
			['owner', true],
			['moderator', true],
			['visitor', false],
		]);
	});
});

describe('feedback replies', () => {
	test('name the replied-to author and flag Team authors', async () => {
		const s = await fixture();
		const boards = await s.owner.caller.query(api.feedbackBoards.list, {
			projectId: s.projectId,
		});
		const created = await s.visitor.caller.mutation(api.feedback.create, {
			boardId: boards[0].id,
			firstComment: '<p>Initial</p>',
			projectId: s.projectId,
			title: 'Dark mode',
		});
		const comment = await s.owner.caller.mutation(api.feedbackComments.create, {
			feedbackId: created.feedbackId,
			content: '<p>On the roadmap.</p>',
		});
		const reply = await s.visitor.caller.mutation(api.feedbackComments.create, {
			feedbackId: created.feedbackId,
			content: '<p>Great!</p>',
			replyFeedbackCommentId: comment.id,
		});

		const detail = await s.t.query(api.feedback.getDetail, {
			projectId: s.projectId,
			slug: created.slug,
		});
		expect(detail?.firstComment).toMatchObject({ isTeamMember: false, replyTo: null });
		const comments = detail?.timeline.flatMap((item) =>
			item.type === 'comment' ? [item.data] : []
		);
		expect(comments).toMatchObject([
			{ id: comment.id, isTeamMember: true, replyTo: null },
			{
				id: reply.id,
				isTeamMember: false,
				replyTo: { id: comment.id, author: { username: 'owner' } },
			},
		]);
	});
});
