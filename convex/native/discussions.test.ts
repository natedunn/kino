// @vitest-environment edge-runtime
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { configureTestAuth, issuer } from '../testing/setup.testing';
import { api, internal } from './_generated/api';
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
	const categories = await owner.caller.query(api.discussionCategories.list, { projectId });
	const category = (slug: string) => {
		const found = categories?.find((row) => row.slug === slug);
		if (!found) throw new Error(`missing category ${slug}`);
		return found.id;
	};
	return {
		t,
		owner,
		visitor,
		moderator,
		projectId,
		general: category('general'),
		qa: category('q-a'),
		announcements: category('announcements'),
	};
}

const page = { cursor: null, numItems: 20 };

describe('native project discussions', () => {
	test('anyone who can view a project starts discussions by default', async () => {
		const s = await fixture();
		expect(
			await s.visitor.caller.query(api.discussions.viewerAccess, { projectId: s.projectId })
		).toMatchObject({ enabled: true, canCreate: true, canManage: false, writable: true });
		const created = await s.visitor.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			categoryId: s.general,
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
				categoryId: s.general,
				title: ' ',
				body: '<p>Body</p>',
			})
		).rejects.toThrow('INVALID_TITLE');
		await expect(
			s.visitor.caller.mutation(api.discussions.create, {
				projectId: s.projectId,
				categoryId: s.general,
				title: 'Title',
				body: '   ',
			})
		).rejects.toThrow('INVALID_COMMENT');
	});

	test('sanitizes discussion and reply HTML before storing it', async () => {
		const s = await fixture();
		const created = await s.visitor.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			categoryId: s.general,
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

	test('enforces visible-text limits on bodies and replies server-side', async () => {
		const s = await fixture();
		await expect(
			s.visitor.caller.mutation(api.discussions.create, {
				projectId: s.projectId,
				categoryId: s.general,
				title: 'Empty',
				body: '<p></p><p> </p>',
			})
		).rejects.toThrow('INVALID_COMMENT');
		const { id } = await s.visitor.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			categoryId: s.general,
			title: 'Long',
			body: `<p>${'a'.repeat(5000)}</p><p>${'b'.repeat(5000)}</p>`,
		});
		await expect(
			s.visitor.caller.mutation(api.discussions.create, {
				projectId: s.projectId,
				categoryId: s.general,
				title: 'Too long',
				body: `<p>${'a'.repeat(10_001)}</p>`,
			})
		).rejects.toThrow('INVALID_COMMENT');
		// Replies use the comment limit; markup and entities don't count.
		const reply = await s.visitor.caller.mutation(api.discussions.addComment, {
			discussionId: id,
			content: `<p><strong>${'x'.repeat(1195)}</strong>&amp;</p><p>1234</p>`,
		});
		await expect(
			s.visitor.caller.mutation(api.discussions.addComment, {
				discussionId: id,
				content: `<p>${'x'.repeat(1201)}</p>`,
			})
		).rejects.toThrow('INVALID_COMMENT');
		await expect(
			s.visitor.caller.mutation(api.discussions.updateComment, {
				commentId: reply,
				content: `<p>${'x'.repeat(1201)}</p>`,
			})
		).rejects.toThrow('INVALID_COMMENT');
		const first = (await s.t.run((ctx) => ctx.db.get('discussions', id)))!.firstCommentId!;
		await s.visitor.caller.mutation(api.discussions.updateComment, {
			commentId: first,
			content: `<p>${'c'.repeat(9000)}</p>`,
		});
	});

	test('shows the viewer their own reaction past the reaction sample cap', async () => {
		const s = await fixture();
		const { id, slug } = await s.owner.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			categoryId: s.general,
			title: 'Popular',
			body: '<p>Body</p>',
		});
		const commentId = (await s.t.run((ctx) => ctx.db.get('discussions', id)))!.firstCommentId!;
		// 101 reactors; the one that sorts last in the index falls outside the
		// 100-row sample, so it is the viewer whose own reaction must still show.
		const viewer = await s.t.run(async (ctx) => {
			for (let index = 0; index < 101; index += 1) {
				const userId = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
				const authorProfileId = await ctx.db.insert('profiles', {
					userId,
					name: `fan${index}`,
					username: `fan${index}`,
				});
				await ctx.db.patch('users', userId, { profileId: authorProfileId });
				await ctx.db.insert('discussionCommentEmotes', {
					discussionId: id,
					commentId,
					authorProfileId,
					content: 'heart',
				});
			}
			const last = await ctx.db
				.query('discussionCommentEmotes')
				.withIndex('by_commentId_and_authorProfileId_and_content', (q) =>
					q.eq('commentId', commentId)
				)
				.order('desc')
				.first();
			const profile = await ctx.db.get('profiles', last!.authorProfileId);
			return { profileId: profile!._id, userId: profile!.userId };
		});
		const detail = await s.t
			.withIdentity({ issuer, subject: viewer.userId })
			.query(api.discussions.detail, { projectId: s.projectId, slug });
		const heart = detail!.firstComment!.emotes.find((emote) => emote.content === 'heart');
		expect(heart?.authorProfileIds).toContain(viewer.profileId);
		expect(heart?.count).toBe(101);
	});

	test('deleting replies rolls last activity back to what remains', async () => {
		const s = await fixture();
		const { id } = await s.visitor.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			categoryId: s.general,
			title: 'Activity',
			body: '<p>Body</p>',
		});
		vi.advanceTimersByTime(60_000);
		const older = await s.visitor.caller.mutation(api.discussions.addComment, {
			discussionId: id,
			content: '<p>Older</p>',
		});
		vi.advanceTimersByTime(60_000);
		const newer = await s.visitor.caller.mutation(api.discussions.addComment, {
			discussionId: id,
			content: '<p>Newer</p>',
		});
		const read = () =>
			s.t.run(async (ctx) => ({
				discussion: (await ctx.db.get('discussions', id))!,
				older: await ctx.db.get('discussionComments', older),
			}));
		await s.visitor.caller.mutation(api.discussions.removeComment, { commentId: newer });
		const afterNewer = await read();
		expect(afterNewer.discussion.lastActivityAt).toBe(afterNewer.older!._creationTime);
		await s.visitor.caller.mutation(api.discussions.removeComment, { commentId: older });
		const afterOlder = await read();
		expect(afterOlder.discussion.lastActivityAt).toBe(afterOlder.discussion._creationTime);
		expect(afterOlder.discussion.commentCount).toBe(0);
	});

	test('team-only categories limit new discussions to admins and moderators', async () => {
		const s = await fixture();
		const access = await s.visitor.caller.query(api.discussions.viewerAccess, {
			projectId: s.projectId,
		});
		expect(access?.categories.find((row) => row.id === s.announcements)).toMatchObject({
			postingPolicy: 'team',
			canPost: false,
		});
		await expect(
			s.visitor.caller.mutation(api.discussions.create, {
				projectId: s.projectId,
				categoryId: s.announcements,
				title: 'Blocked',
				body: '<p>Nope</p>',
			})
		).rejects.toThrow('DISCUSSIONS_TEAM_ONLY');
		const fromModerator = await s.moderator.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			categoryId: s.announcements,
			title: 'Release plan',
			body: '<p>Thoughts?</p>',
		});
		// Replies stay open to everyone who can view the project.
		await s.visitor.caller.mutation(api.discussions.addComment, {
			discussionId: fromModerator.id,
			content: '<p>Looks good</p>',
		});
		// Authors can't move their own discussion into a team-only category.
		const own = await s.visitor.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			categoryId: s.general,
			title: 'Mine',
			body: '<p>Body</p>',
		});
		await expect(
			s.visitor.caller.mutation(api.discussions.setCategory, {
				discussionId: own.id,
				categoryId: s.announcements,
			})
		).rejects.toThrow('DISCUSSIONS_TEAM_ONLY');
		await s.visitor.caller.mutation(api.discussions.setCategory, {
			discussionId: own.id,
			categoryId: s.qa,
		});
	});

	test('only content managers manage categories, and deleting one moves its discussions', async () => {
		const s = await fixture();
		const fields = {
			projectId: s.projectId,
			name: 'Help',
			slug: 'help',
			format: 'qa' as const,
			postingPolicy: 'everyone' as const,
		};
		await expect(
			s.visitor.caller.mutation(api.discussionCategories.create, fields)
		).rejects.toThrow('FORBIDDEN');
		await expect(
			s.owner.caller.mutation(api.discussionCategories.create, { ...fields, slug: 'general' })
		).rejects.toThrow('CATEGORY_SLUG_TAKEN');
		const help = await s.moderator.caller.mutation(api.discussionCategories.create, fields);
		const { id } = await s.visitor.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			categoryId: help,
			title: 'Filed under help',
			body: '<p>Body</p>',
		});
		await s.owner.caller.mutation(api.discussionCategories.remove, {
			categoryId: help,
			moveToCategoryId: s.general,
		});
		await s.t.finishAllScheduledFunctions(vi.runAllTimers);
		expect((await s.t.run((ctx) => ctx.db.get('discussions', id)))?.categoryId).toBe(s.general);
		const slugs = (await s.t.query(api.discussionCategories.list, { projectId: s.projectId }))?.map(
			(row) => row.slug
		);
		expect(slugs).toEqual(['general', 'q-a', 'ideas', 'show-and-tell', 'announcements']);
		const ids = (await s.t.query(api.discussionCategories.list, { projectId: s.projectId }))!.map(
			(row) => row.id
		);
		await s.owner.caller.mutation(api.discussionCategories.reorder, {
			projectId: s.projectId,
			categoryIds: [...ids].reverse(),
		});
		expect(
			(await s.t.query(api.discussionCategories.list, { projectId: s.projectId }))?.[0]?.slug
		).toBe('announcements');
	});

	test('filters by category, sorts, and narrows to unanswered or mine', async () => {
		const s = await fixture();
		const general = await s.visitor.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			categoryId: s.general,
			title: 'General chat',
			body: '<p>Hi</p>',
		});
		const question = await s.owner.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			categoryId: s.qa,
			title: 'How do exports work?',
			body: '<p>Question</p>',
		});
		vi.advanceTimersByTime(1000);
		const reply = await s.visitor.caller.mutation(api.discussions.addComment, {
			discussionId: general.id,
			content: '<p>Reply</p>',
		});
		const ids = async (args: Record<string, unknown>, caller = s.t) =>
			(
				await caller.query(api.discussions.list, {
					projectId: s.projectId,
					paginationOpts: page,
					...args,
				})
			).page.map((item) => item.id);
		expect(await ids({})).toEqual([general.id, question.id]);
		expect(await ids({ sort: 'newest' })).toEqual([question.id, general.id]);
		expect(await ids({ categoryId: s.qa })).toEqual([question.id]);
		expect(await ids({ filter: 'mine' }, s.owner.caller)).toEqual([question.id]);
		// Signed-out viewers have nothing of their own.
		expect(await ids({ filter: 'mine' })).toEqual([]);
		expect(await ids({ categoryId: s.qa, filter: 'unanswered' })).toEqual([question.id]);
		await expect(
			s.owner.caller.mutation(api.discussions.setAnswer, {
				discussionId: general.id,
				commentId: reply,
			})
		).rejects.toThrow('ANSWERS_NOT_ENABLED');
		const answer = await s.visitor.caller.mutation(api.discussions.addComment, {
			discussionId: question.id,
			content: '<p>Use the export button.</p>',
		});
		// Only the author or a manager marks the answer.
		await expect(
			s.visitor.caller.mutation(api.discussions.setAnswer, {
				discussionId: question.id,
				commentId: answer,
			})
		).rejects.toThrow('FORBIDDEN');
		await s.owner.caller.mutation(api.discussions.setAnswer, {
			discussionId: question.id,
			commentId: answer,
		});
		expect(await ids({ categoryId: s.qa, filter: 'unanswered' })).toEqual([]);
		const detail = await s.t.query(api.discussions.detail, {
			projectId: s.projectId,
			slug: question.slug,
		});
		expect(detail?.answer?.id).toBe(answer);
		expect(detail?.participants.total).toBe(2);
		// Deleting the answer clears it.
		await s.visitor.caller.mutation(api.discussions.removeComment, { commentId: answer });
		expect(
			(await s.t.run((ctx) => ctx.db.get('discussions', question.id)))?.answerCommentId
		).toBeUndefined();
	});

	test('authors and repliers follow automatically; following filters the list', async () => {
		const s = await fixture();
		const { id, slug } = await s.owner.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			categoryId: s.general,
			title: 'Followed',
			body: '<p>Body</p>',
		});
		const following = async (caller: typeof s.visitor.caller) =>
			(
				await caller.query(api.discussions.list, {
					projectId: s.projectId,
					filter: 'following',
					paginationOpts: page,
				})
			).page.map((item) => item.id);
		expect(await following(s.owner.caller)).toEqual([id]);
		expect(await following(s.visitor.caller)).toEqual([]);
		await s.visitor.caller.mutation(api.discussions.addComment, {
			discussionId: id,
			content: '<p>Me too</p>',
		});
		expect(await following(s.visitor.caller)).toEqual([id]);
		expect(
			await s.visitor.caller.mutation(api.discussions.toggleFollow, { discussionId: id })
		).toEqual({ following: false });
		expect(
			(await s.visitor.caller.query(api.discussions.detail, { projectId: s.projectId, slug }))
				?.viewerFollowing
		).toBe(false);
	});

	test('managers pin up to four and lock; locked threads only take manager replies', async () => {
		const s = await fixture();
		const created = [];
		for (const title of ['One', 'Two', 'Three', 'Four', 'Five'])
			created.push(
				await s.visitor.caller.mutation(api.discussions.create, {
					projectId: s.projectId,
					categoryId: s.general,
					title,
					body: '<p>Body</p>',
				})
			);
		await expect(
			s.visitor.caller.mutation(api.discussions.setPinned, {
				discussionId: created[0]!.id,
				pinned: true,
			})
		).rejects.toThrow('FORBIDDEN');
		for (const item of created.slice(0, 4)) {
			vi.advanceTimersByTime(1);
			await s.moderator.caller.mutation(api.discussions.setPinned, {
				discussionId: item.id,
				pinned: true,
			});
		}
		await expect(
			s.owner.caller.mutation(api.discussions.setPinned, {
				discussionId: created[4]!.id,
				pinned: true,
			})
		).rejects.toThrow('PIN_LIMIT');
		const pinned = await s.t.query(api.discussions.pinned, { projectId: s.projectId });
		expect(pinned.map((item) => item.title)).toEqual(['Four', 'Three', 'Two', 'One']);

		const target = created[0]!.id;
		await s.moderator.caller.mutation(api.discussions.setLocked, {
			discussionId: target,
			locked: true,
		});
		await expect(
			s.visitor.caller.mutation(api.discussions.addComment, {
				discussionId: target,
				content: '<p>Blocked</p>',
			})
		).rejects.toThrow('DISCUSSION_LOCKED');
		await s.owner.caller.mutation(api.discussions.addComment, {
			discussionId: target,
			content: '<p>Team note</p>',
		});
	});

	test('managers link feedback and convert a discussion into feedback', async () => {
		const s = await fixture();
		const { id, slug } = await s.visitor.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			categoryId: s.general,
			title: 'Dark mode please',
			body: '<p>It would be <em>great</em>.</p>',
		});
		const boards = await s.t.query(api.feedbackBoards.list, { projectId: s.projectId });
		const boardId = boards![0]!.id;
		await expect(
			s.visitor.caller.mutation(api.discussions.convertToFeedback, { discussionId: id, boardId })
		).rejects.toThrow('FORBIDDEN');
		const { feedbackSlug } = await s.owner.caller.mutation(api.discussions.convertToFeedback, {
			discussionId: id,
			boardId,
		});
		const feedback = await s.t.run((ctx) =>
			ctx.db
				.query('feedback')
				.withIndex('by_projectId_and_slug', (q) =>
					q.eq('projectId', s.projectId).eq('slug', feedbackSlug)
				)
				.unique()
		);
		expect(feedback).toMatchObject({ title: 'Dark mode please' });
		const visitorProfile = s.visitor.profileId;
		expect(feedback?.authorProfileId).toBe(visitorProfile);
		const detail = await s.t.query(api.discussions.detail, { projectId: s.projectId, slug });
		expect(detail?.discussion.locked).toBe(true);
		expect(detail?.links).toMatchObject([{ kind: 'feedback', slug: feedbackSlug }]);
		// Linking the same feedback again is a no-op.
		await s.owner.caller.mutation(api.discussions.addLink, {
			discussionId: id,
			target: { kind: 'feedback', id: feedback!._id },
		});
		const again = await s.t.query(api.discussions.detail, { projectId: s.projectId, slug });
		expect(again?.links).toHaveLength(1);
		await s.owner.caller.mutation(api.discussions.removeLink, { linkId: again!.links[0]!.id });
		expect(
			(await s.t.query(api.discussions.detail, { projectId: s.projectId, slug }))?.links
		).toEqual([]);
	});

	test('records moderation events and links a converted discussion both ways', async () => {
		const s = await fixture();
		const { id, slug } = await s.visitor.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			categoryId: s.general,
			title: 'Export ideas',
			body: '<p>Body</p>',
		});
		await s.visitor.caller.mutation(api.discussions.updateTitle, {
			discussionId: id,
			title: 'CSV export ideas',
		});
		await s.visitor.caller.mutation(api.discussions.setCategory, {
			discussionId: id,
			categoryId: s.qa,
		});
		await s.owner.caller.mutation(api.discussions.setPinned, { discussionId: id, pinned: true });
		// Repeating a state change records nothing.
		await s.owner.caller.mutation(api.discussions.setPinned, { discussionId: id, pinned: true });
		const boards = await s.t.query(api.feedbackBoards.list, { projectId: s.projectId });
		const { feedbackSlug } = await s.owner.caller.mutation(api.discussions.convertToFeedback, {
			discussionId: id,
			boardId: boards![0]!.id,
		});
		const detail = await s.t.query(api.discussions.detail, { projectId: s.projectId, slug });
		expect(detail?.events).toMatchObject([
			{
				eventType: 'title_changed',
				actor: { username: 'visitor' },
				oldValue: 'Export ideas',
				newValue: 'CSV export ideas',
			},
			{ eventType: 'category_changed', oldValue: 'General', newValue: 'Q&A' },
			{ eventType: 'pinned', actor: { username: 'owner' } },
			{ eventType: 'converted_to_feedback', feedback: { slug: feedbackSlug } },
			{ eventType: 'locked', actor: { username: 'owner' } },
		]);
		expect(detail?.convertedTo).toMatchObject({ slug: feedbackSlug, title: 'CSV export ideas' });

		const feedback = await s.t.run((ctx) =>
			ctx.db
				.query('feedback')
				.withIndex('by_projectId_and_slug', (q) =>
					q.eq('projectId', s.projectId).eq('slug', feedbackSlug)
				)
				.unique()
		);
		const timeline = await s.t.query(api.feedback.listTimelinePage, {
			feedbackId: feedback!._id,
			paginationOpts: page,
		});
		expect(timeline?.page).toMatchObject([
			{
				type: 'event',
				data: {
					eventType: 'imported_from_discussion',
					actor: { username: 'owner' },
					discussion: { slug, title: 'CSV export ideas' },
				},
			},
		]);
	});

	test('disabling discussions hides them; only settings editors toggle it', async () => {
		const s = await fixture();
		const { slug } = await s.visitor.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			categoryId: s.general,
			title: 'Soon hidden',
			body: '<p>Body</p>',
		});
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
			s.visitor.caller.mutation(api.settings.updateProject, { ...base, discussionsEnabled: false })
		).rejects.toThrow();
		const saved = await s.moderator.caller.mutation(api.settings.updateProject, {
			...base,
			discussionsEnabled: false,
		});
		expect(saved.discussionsEnabled).toBe(false);
		// Omitting the field keeps the stored setting.
		expect(
			(await s.owner.caller.mutation(api.settings.updateProject, base)).discussionsEnabled
		).toBe(false);
		expect(await s.t.query(api.discussions.viewerAccess, { projectId: s.projectId })).toMatchObject(
			{ enabled: false }
		);
		expect(await s.t.query(api.discussions.detail, { projectId: s.projectId, slug })).toBeNull();
		await expect(
			s.visitor.caller.mutation(api.discussions.create, {
				projectId: s.projectId,
				categoryId: s.general,
				title: 'Blocked',
				body: '<p>Body</p>',
			})
		).rejects.toThrow('DISCUSSIONS_DISABLED');
	});

	test('keeps replies, counts, reactions and edits authorized', async () => {
		const s = await fixture();
		const { id } = await s.visitor.caller.mutation(api.discussions.create, {
			projectId: s.projectId,
			categoryId: s.general,
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
			categoryId: s.general,
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
			categoryId: s.general,
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
			categoryId: s.general,
			title: 'Doomed',
			body: '<p>Body</p>',
		});
		await s.visitor.caller.mutation(api.discussions.addComment, {
			discussionId: id,
			content: '<p>Reply</p>',
		});
		await s.owner.caller.mutation(api.discussions.setLocked, { discussionId: id, locked: true });
		expect(await s.t.run((ctx) => ctx.db.query('discussionEvents').collect())).toHaveLength(1);
		await s.owner.caller.mutation(api.projectDeletion.remove, { id: s.projectId });
		await s.t.finishAllScheduledFunctions(vi.runAllTimers);
		expect(await s.t.run((ctx) => ctx.db.query('discussions').collect())).toHaveLength(0);
		expect(await s.t.run((ctx) => ctx.db.query('discussionComments').collect())).toHaveLength(0);
		expect(await s.t.run((ctx) => ctx.db.query('discussionWatchers').collect())).toHaveLength(0);
		expect(await s.t.run((ctx) => ctx.db.query('discussionEvents').collect())).toHaveLength(0);
		expect(await s.t.run((ctx) => ctx.db.query('discussionCategories').collect())).toHaveLength(0);
	});

	test('backfill seeds categories for older projects and files their discussions', async () => {
		const s = await fixture();
		const legacy = await s.t.run(async (ctx) => {
			for (const row of await ctx.db.query('discussionCategories').collect())
				await ctx.db.delete('discussionCategories', row._id);
			return ctx.db.insert('discussions', {
				projectId: s.projectId,
				authorProfileId: s.visitor.profileId,
				slug: 'legacy',
				title: 'Legacy',
				searchContent: 'Legacy',
				commentCount: 0,
				lastActivityAt: Date.now(),
			});
		});
		await s.t.mutation(internal.discussionCategories.backfillDefaults, {});
		await s.t.finishAllScheduledFunctions(vi.runAllTimers);
		const categories = await s.t.query(api.discussionCategories.list, { projectId: s.projectId });
		expect(categories?.map((row) => row.slug)).toEqual([
			'general',
			'q-a',
			'ideas',
			'show-and-tell',
			'announcements',
		]);
		expect((await s.t.run((ctx) => ctx.db.get('discussions', legacy)))?.categoryId).toBe(
			categories?.[0]?.id
		);
	});
});
