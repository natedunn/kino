// @vitest-environment edge-runtime
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { configureTestAuth, issuer } from '../testing/setup.testing';
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
		return { ...ids, caller: t.withIdentity({ issuer, subject: ids.userId }) };
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
	return { t, owner, visitor, moderator, projectId };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

async function setPolicy(s: Fixture, policy: 'everyone' | 'team') {
	await s.t.run((ctx) =>
		ctx.db.patch('projects', s.projectId, { discussionsPostingPolicy: policy })
	);
}

const page = { cursor: null, numItems: 20 };

describe('native project discussions', () => {
	test('anyone who can view a project starts discussions by default', async () => {
		const s = await fixture();
		expect(
			await s.visitor.caller.query(api.discussions.viewerAccess, { projectId: s.projectId })
		).toEqual({ canCreate: true, postingPolicy: 'everyone', writable: true });
		const created = await s.visitor.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			title: '  How do I export data?  ',
			body: '<p>Looking for a <strong>CSV</strong> export.</p>',
		});
		const detail = await s.t.query(api.discussions.detail, {
			projectId: s.projectId,
			slug: created.slug,
		});
		expect(detail).toMatchObject({
			discussion: { title: 'How do I export data?', commentCount: 0 },
			author: { username: 'visitor' },
			firstComment: { content: '<p>Looking for a <strong>CSV</strong> export.</p>' },
			viewerProfileId: null,
			canDelete: false,
		});
		const list = await s.t.query(api.discussions.list, {
			projectId: s.projectId,
			paginationOpts: page,
		});
		expect(list.page).toMatchObject([{ id: created.id, excerpt: 'Looking for a CSV export.' }]);
		const search = await s.t.query(api.discussions.list, {
			projectId: s.projectId,
			search: 'CSV',
			paginationOpts: page,
		});
		expect(search.page.map((item) => item.id)).toEqual([created.id]);
	});

	test('rejects a missing title or body', async () => {
		const s = await fixture();
		await expect(
			s.visitor.caller.mutation(api.discussions.create, {
				projectId: s.projectId,
				title: ' ',
				body: '<p>Body</p>',
			})
		).rejects.toThrow('INVALID_TITLE');
		await expect(
			s.visitor.caller.mutation(api.discussions.create, {
				projectId: s.projectId,
				title: 'Title',
				body: '   ',
			})
		).rejects.toThrow('INVALID_COMMENT');
	});

	test('sanitizes discussion and reply HTML before storing it', async () => {
		const s = await fixture();
		const created = await s.visitor.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			title: 'Sanitized',
			body: '<p onclick="steal()">Hi<script>alert(1)</script></p><img src=x onerror=alert(1)>',
		});
		const reply = await s.visitor.caller.mutation(api.discussions.addComment, {
			discussionId: created.id,
			content: '<p><a href="javascript:alert(1)">x</a></p>',
		});
		await expect(
			s.visitor.caller.mutation(api.discussions.addComment, {
				discussionId: created.id,
				content: '<script>alert(1)</script>',
			})
		).rejects.toThrow('INVALID_COMMENT');
		await s.visitor.caller.mutation(api.discussions.updateComment, {
			commentId: reply,
			content: '<p>Edited<img src=x onerror=alert(1)></p>',
		});
		// Plain text renders as escaped text, so it is stored verbatim.
		const plain = await s.visitor.caller.mutation(api.discussions.addComment, {
			discussionId: created.id,
			content: '  a < b  ',
		});

		const stored = await s.t.run(async (ctx) => {
			const discussion = await ctx.db.get('discussions', created.id);
			return {
				body: (await ctx.db.get('discussionComments', discussion!.firstCommentId!))!.content,
				reply: (await ctx.db.get('discussionComments', reply))!.content,
				plain: (await ctx.db.get('discussionComments', plain))!.content,
			};
		});
		expect(stored).toEqual({ body: '<p>Hi</p>', reply: '<p>Edited</p>', plain: 'a < b' });
	});

	test('team-only posting limits new discussions to admins and moderators', async () => {
		const s = await fixture();
		await setPolicy(s, 'team');
		expect(
			await s.visitor.caller.query(api.discussions.viewerAccess, { projectId: s.projectId })
		).toMatchObject({ canCreate: false, postingPolicy: 'team' });
		await expect(
			s.visitor.caller.mutation(api.discussions.create, {
				projectId: s.projectId,
				title: 'Blocked',
				body: '<p>Nope</p>',
			})
		).rejects.toThrow('DISCUSSIONS_TEAM_ONLY');
		const fromModerator = await s.moderator.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			title: 'Release plan',
			body: '<p>Thoughts?</p>',
		});
		await s.owner.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			title: 'Owner post',
			body: '<p>Hello</p>',
		});
		// Replies stay open to everyone who can view the project.
		await s.visitor.caller.mutation(api.discussions.addComment, {
			discussionId: fromModerator.id,
			content: '<p>Looks good</p>',
		});
	});

	test('only editors of project settings can change the posting policy', async () => {
		const s = await fixture();
		const base = {
			id: s.projectId,
			name: 'Product',
			slug: 'product',
			description: '',
			visibility: 'public' as const,
			updatesFeaturedMode: 'latest' as const,
			urls: [],
		};
		await expect(
			s.visitor.caller.mutation(api.settings.updateProject, {
				...base,
				discussionsPostingPolicy: 'team',
			})
		).rejects.toThrow();
		const saved = await s.moderator.caller.mutation(api.settings.updateProject, {
			...base,
			discussionsPostingPolicy: 'team',
		});
		expect(saved.discussionsPostingPolicy).toBe('team');
		// Omitting the field keeps the stored policy.
		expect(
			(await s.owner.caller.mutation(api.settings.updateProject, base)).discussionsPostingPolicy
		).toBe('team');
	});

	test('keeps replies, counts, reactions and edits authorized', async () => {
		const s = await fixture();
		const { id } = await s.visitor.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			title: 'Question',
			body: '<p>Body</p>',
		});
		const reply = await s.owner.caller.mutation(api.discussions.addComment, {
			discussionId: id,
			content: '<p>Answer</p>',
		});
		await s.visitor.caller.mutation(api.discussions.addComment, {
			discussionId: id,
			content: '<p>Thanks</p>',
		});
		expect(
			await s.visitor.caller.mutation(api.discussions.toggleReaction, {
				commentId: reply,
				content: 'heart',
			})
		).toBe(true);
		const replies = await s.visitor.caller.query(api.discussions.replies, {
			discussionId: id,
			paginationOpts: page,
		});
		expect(replies.page.map((item) => item.content)).toEqual(['<p>Answer</p>', '<p>Thanks</p>']);
		expect(replies.page[0]).toMatchObject({
			canEdit: false,
			canDelete: false,
			emotes: [{ content: 'heart', count: 1, authorProfileIds: [s.visitor.profileId] }],
		});
		expect(replies.page[1]).toMatchObject({ canEdit: true, canDelete: true });

		await expect(
			s.visitor.caller.mutation(api.discussions.updateComment, {
				commentId: reply,
				content: '<p>Hijack</p>',
			})
		).rejects.toThrow('FORBIDDEN');
		await expect(
			s.visitor.caller.mutation(api.discussions.removeComment, { commentId: reply })
		).rejects.toThrow('FORBIDDEN');

		const detail = await s.visitor.caller.query(api.discussions.detail, {
			projectId: s.projectId,
			slug: (await s.t.run((ctx) => ctx.db.get('discussions', id)))!.slug,
		});
		expect(detail?.discussion.commentCount).toBe(2);
		expect(detail?.firstComment).toMatchObject({ canEdit: true, canDelete: false });
		await expect(
			s.visitor.caller.mutation(api.discussions.removeComment, {
				commentId: detail!.firstComment!.id,
			})
		).rejects.toThrow('INITIAL_COMMENT_REQUIRED');
		await s.visitor.caller.mutation(api.discussions.updateComment, {
			commentId: detail!.firstComment!.id,
			content: '<p>Edited body about webhooks</p>',
		});
		const search = await s.t.query(api.discussions.list, {
			projectId: s.projectId,
			search: 'webhooks',
			paginationOpts: page,
		});
		expect(search.page.map((item) => item.id)).toEqual([id]);

		// Managers moderate replies; the discussion count follows.
		await s.moderator.caller.mutation(api.discussions.removeComment, { commentId: reply });
		expect((await s.t.run((ctx) => ctx.db.get('discussions', id)))?.commentCount).toBe(1);
		await s.t.finishAllScheduledFunctions(vi.runAllTimers);
		expect(await s.t.run((ctx) => ctx.db.query('discussionCommentEmotes').collect())).toHaveLength(
			0
		);
	});

	test('authors and managers retitle, only managers delete', async () => {
		const s = await fixture();
		const { id, slug } = await s.visitor.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			title: 'Original',
			body: '<p>Body</p>',
		});
		await s.visitor.caller.mutation(api.discussions.updateTitle, {
			discussionId: id,
			title: 'Renamed',
		});
		await s.moderator.caller.mutation(api.discussions.updateTitle, {
			discussionId: id,
			title: 'Moderated',
		});
		await expect(
			s.visitor.caller.mutation(api.discussions.remove, { discussionId: id })
		).rejects.toThrow('FORBIDDEN');
		await s.visitor.caller.mutation(api.discussions.addComment, {
			discussionId: id,
			content: '<p>Reply</p>',
		});
		await s.owner.caller.mutation(api.discussions.remove, { discussionId: id });
		expect(await s.t.query(api.discussions.detail, { projectId: s.projectId, slug })).toBeNull();
		await s.t.finishAllScheduledFunctions(vi.runAllTimers);
		expect(await s.t.run((ctx) => ctx.db.query('discussionComments').collect())).toHaveLength(0);
		expect(await s.t.run((ctx) => ctx.db.get('discussions', id))).toBeNull();
	});

	test('hides private projects and fences archived ones', async () => {
		const s = await fixture();
		const { id, slug } = await s.visitor.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			title: 'Visible',
			body: '<p>Body</p>',
		});
		await s.owner.caller.mutation(api.policy.updateProject, {
			projectId: s.projectId,
			visibility: 'private',
		});
		expect(
			await s.visitor.caller.query(api.discussions.detail, { projectId: s.projectId, slug })
		).toBeNull();
		expect(
			(
				await s.visitor.caller.query(api.discussions.list, {
					projectId: s.projectId,
					paginationOpts: page,
				})
			).page
		).toEqual([]);
		await expect(
			s.visitor.caller.mutation(api.discussions.addComment, {
				discussionId: id,
				content: '<p>Sneaky</p>',
			})
		).rejects.toThrow('DISCUSSION_NOT_FOUND');

		await s.owner.caller.mutation(api.policy.updateProject, {
			projectId: s.projectId,
			visibility: 'archived',
		});
		expect(
			await s.owner.caller.query(api.discussions.viewerAccess, { projectId: s.projectId })
		).toMatchObject({ canCreate: false, writable: false });
		await expect(
			s.owner.caller.mutation(api.discussions.addComment, {
				discussionId: id,
				content: '<p>Archived</p>',
			})
		).rejects.toThrow('PROJECT_ARCHIVED');
	});

	test('project deletion drains discussions', async () => {
		const s = await fixture();
		const { id } = await s.visitor.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			title: 'Doomed',
			body: '<p>Body</p>',
		});
		await s.visitor.caller.mutation(api.discussions.addComment, {
			discussionId: id,
			content: '<p>Reply</p>',
		});
		await s.owner.caller.mutation(api.projectDeletion.remove, { id: s.projectId });
		await s.t.finishAllScheduledFunctions(vi.runAllTimers);
		expect(await s.t.run((ctx) => ctx.db.query('discussions').collect())).toHaveLength(0);
		expect(await s.t.run((ctx) => ctx.db.query('discussionComments').collect())).toHaveLength(0);
	});
});
