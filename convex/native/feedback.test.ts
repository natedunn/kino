// @vitest-environment edge-runtime
import type { Id } from './_generated/dataModel';

import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { configureTestAuth, issuer } from '../testing/setup.testing';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.testing.ts']);

beforeEach(async () => {
	await configureTestAuth();
	for (const key of ['BENTO_PUBLISHABLE_KEY', 'BENTO_SECRET_KEY', 'BENTO_SITE_UUID', 'BENTO_FROM'])
		vi.stubEnv(key, 'test-only');
});

afterEach(() => vi.unstubAllEnvs());

function setup() {
	const t = convexTest(schema, modules);
	registerRateLimiter(t, 'authLimits');
	return t;
}

type Backend = ReturnType<typeof setup>;

async function createUser(t: Backend, label: string) {
	const userId = await t.run(async (ctx) => {
		const id = await ctx.db.insert('users', {
			status: 'active',
			systemRole: 'user',
			passwordEmail: `${label}@example.test`,
			passwordEmailVerifiedAt: Date.now(),
		});
		const profileId = await ctx.db.insert('profiles', {
			userId: id,
			name: label,
			username: label,
		});
		await ctx.db.patch('users', id, { profileId });
		return { profileId, userId: id };
	});
	return {
		...userId,
		caller: t.withIdentity({ issuer, subject: userId.userId }),
	};
}

async function fixture() {
	const t = setup();
	const owner = await createUser(t, 'owner');
	const member = await createUser(t, 'member');
	const moderator = await createUser(t, 'moderator');
	const outsider = await createUser(t, 'outsider');
	const organizationId = await owner.caller.mutation(api.organizations.create, {
		name: 'Acme',
		slug: 'acme',
	});
	const projectId = await owner.caller.mutation(api.policy.createProject, {
		organizationId,
		name: 'Product',
		slug: 'product',
	});
	const boards = await owner.caller.query(api.feedbackBoards.list, { projectId });
	return { t, owner, member, moderator, outsider, organizationId, projectId, boards: boards! };
}

async function directMember(
	s: Awaited<ReturnType<typeof fixture>>,
	userId: Id<'users'>,
	enabled = true
) {
	await s.owner.caller.mutation(api.policy.setDirectProjectMember, {
		projectId: s.projectId,
		userId,
		enabled,
	});
}

async function assignedModerator(s: Awaited<ReturnType<typeof fixture>>) {
	const invitationId = await s.owner.caller.mutation(api.invitations.create, {
		organizationId: s.organizationId,
		email: 'moderator@example.test',
		role: 'moderator',
		projectIds: [s.projectId],
	});
	return s.moderator.caller.mutation(api.invitations.accept, { invitationId });
}

describe('native project feedback vertical slice', () => {
	test('a deleting board hides feedback and fences cross-domain writes before cleanup', async () => {
		const s = await fixture();
		const item = await s.owner.caller.mutation(api.feedback.create, {
			projectId: s.projectId,
			boardId: s.boards[0].id,
			title: 'Board lifecycle',
			firstComment: 'Initial',
		});
		const other = await s.owner.caller.mutation(api.feedback.create, {
			projectId: s.projectId,
			boardId: s.boards[1].id,
			title: 'Unaffected',
			firstComment: 'Initial',
		});
		const release = await s.owner.caller.mutation(api.updates.save, {
			projectId: s.projectId,
			title: 'Release',
			content: '<p>Release</p>',
			tags: [],
			category: 'changelog',
			featured: false,
			relatedFeedbackIds: [item.feedbackId, other.feedbackId],
		});
		await s.t.run((ctx) => ctx.db.patch('feedbackBoards', s.boards[0].id, { deletingAt: 0 }));
		const editor = await s.owner.caller.query(api.updatesWorkspace.detail, {
			projectId: s.projectId,
			slug: release.slug,
		});
		expect(editor?.update.relatedFeedbackIds).toEqual([other.feedbackId]);
		await s.owner.caller.mutation(api.updatesWorkspace.change, {
			id: release.id,
			title: 'Still editable',
		});
		expect((await s.t.run((ctx) => ctx.db.get('updates', release.id)))?.relatedFeedbackIds).toEqual(
			[other.feedbackId]
		);
		expect(
			await s.owner.caller.query(api.feedback.getDetail, {
				projectId: s.projectId,
				slug: item.slug,
			})
		).toBeNull();
		expect(
			await s.owner.caller.query(api.feedback.listTimelinePage, {
				feedbackId: item.feedbackId,
				paginationOpts: { numItems: 20, cursor: null },
			})
		).toBeNull();
		const page = await s.owner.caller.query(api.feedback.list, {
			projectId: s.projectId,
			paginationOpts: { numItems: 20, cursor: null },
		});
		expect(page?.page.map((row) => row.id)).toEqual([other.feedbackId]);
		expect(
			await s.owner.caller.query(api.feedback.searchForLinking, {
				projectId: s.projectId,
				search: 'lifecycle',
			})
		).toEqual([]);
		await expect(
			s.owner.caller.mutation(api.feedback.toggleUpvote, { feedbackId: item.feedbackId })
		).rejects.toThrow('FEEDBACK_NOT_FOUND');
		await expect(
			s.owner.caller.mutation(api.feedbackComments.create, {
				feedbackId: item.feedbackId,
				content: 'Late comment',
			})
		).rejects.toThrow('FEEDBACK_NOT_FOUND');
		await expect(
			s.owner.caller.mutation(api.feedback.create, {
				projectId: s.projectId,
				boardId: s.boards[0].id,
				title: 'Late',
				firstComment: 'Late',
			})
		).rejects.toThrow('INVALID_BOARD');
		await expect(
			s.owner.caller.mutation(api.feedback.updateBoard, {
				feedbackId: other.feedbackId,
				boardId: s.boards[0].id,
			})
		).rejects.toThrow('INVALID_BOARD');
		await expect(
			s.owner.caller.mutation(api.feedback.addRelation, {
				feedbackId: other.feedbackId,
				relatedFeedbackId: item.feedbackId,
			})
		).rejects.toThrow('INVALID_RELATION');
		await expect(
			s.owner.caller.mutation(api.updates.save, {
				projectId: s.projectId,
				title: 'Release',
				content: '<p>Release</p>',
				tags: [],
				category: 'changelog',
				featured: false,
				relatedFeedbackIds: [item.feedbackId],
			})
		).rejects.toThrow('INVALID_RELATED_FEEDBACK');
		expect(
			await s.owner.caller.query(api.relayFeedback.listByFeedback, { feedbackId: item.feedbackId })
		).toEqual([]);
		await expect(
			s.owner.caller.query(api.relayFeedback.getAvailability, { feedbackId: item.feedbackId })
		).rejects.toThrow('FEEDBACK_NOT_FOUND');
	});

	test('creates the three project boards atomically and hides private reads', async () => {
		const s = await fixture();
		expect(s.boards.map((board) => board.slug)).toEqual([
			'bugs',
			'feature-requests',
			'improvements',
		]);
		expect(
			await s.outsider.caller.query(api.projects.getBySlugs, {
				organizationSlug: 'acme',
				projectSlug: 'product',
			})
		).toBeNull();
		expect(
			await s.outsider.caller.query(api.feedbackBoards.list, { projectId: s.projectId })
		).toBeNull();
	});

	test('creates, paginates, filters and searches feedback without leaking private projects', async () => {
		const s = await fixture();
		await directMember(s, s.member.userId);
		const bugs = s.boards.find((board) => board.slug === 'bugs')!;
		const improvements = s.boards.find((board) => board.slug === 'improvements')!;
		const first = await s.member.caller.mutation(api.feedback.create, {
			boardId: bugs.id,
			firstComment: '<p>The export button crashes reliably.</p>',
			projectId: s.projectId,
			title: 'Export crash',
		});
		await s.member.caller.mutation(api.feedback.create, {
			boardId: improvements.id,
			firstComment: '<p>Please make navigation faster.</p>',
			projectId: s.projectId,
			title: 'Faster navigation',
		});

		const page = await s.member.caller.query(api.feedback.list, {
			projectId: s.projectId,
			boardId: bugs.id,
			paginationOpts: { cursor: null, numItems: 10 },
		});
		expect(page?.page).toEqual([
			expect.objectContaining({ id: first.feedbackId, title: 'Export crash' }),
		]);
		const search = await s.member.caller.query(api.feedback.list, {
			projectId: s.projectId,
			search: 'navigation',
			paginationOpts: { cursor: null, numItems: 10 },
		});
		expect(search?.page.map((item) => item.title)).toEqual(['Faster navigation']);
		expect(
			await s.outsider.caller.query(api.feedback.list, {
				projectId: s.projectId,
				paginationOpts: { cursor: null, numItems: 10 },
			})
		).toBeNull();
	});

	test('keeps votes, comments, reactions and timeline updates authorized and reactive', async () => {
		const s = await fixture();
		await directMember(s, s.member.userId);
		await assignedModerator(s);
		const board = s.boards[0];
		const created = await s.member.caller.mutation(api.feedback.create, {
			boardId: board.id,
			firstComment: '<p>Initial details</p>',
			projectId: s.projectId,
			title: 'Feedback title',
		});
		expect(
			await s.member.caller.mutation(api.feedback.toggleUpvote, {
				feedbackId: created.feedbackId,
			})
		).toEqual({ count: 1, upvoted: true });
		const comment = await s.member.caller.mutation(api.feedbackComments.create, {
			feedbackId: created.feedbackId,
			content: '<p>Follow-up</p>',
		});
		expect(
			await s.moderator.caller.mutation(api.feedbackComments.toggleEmote, {
				feedbackId: created.feedbackId,
				feedbackCommentId: comment.id,
				content: '👍',
			})
		).toEqual({ action: 'added' });
		await s.member.caller.mutation(api.feedback.updateStatus, {
			feedbackId: created.feedbackId,
			status: 'in-progress',
		});
		await s.moderator.caller.mutation(api.feedback.updatePriority, {
			feedbackId: created.feedbackId,
			priority: 'high',
		});

		const detail = await s.member.caller.query(api.feedback.getDetail, {
			projectId: s.projectId,
			slug: created.slug,
		});
		expect(detail).toMatchObject({
			feedback: { priority: 'high', status: 'in-progress', upvotes: 1 },
			hasUpvoted: true,
		});
		expect(detail?.timeline.map((item) => item.type)).toEqual(['comment', 'event', 'event']);
		expect(detail?.timeline[0]).toMatchObject({
			type: 'comment',
			data: { emotes: [{ content: '👍', count: 1 }] },
		});
	});

	test('revocation and archive state stop every feedback write on the next transaction', async () => {
		const s = await fixture();
		await directMember(s, s.member.userId);
		const created = await s.member.caller.mutation(api.feedback.create, {
			boardId: s.boards[0].id,
			firstComment: '<p>Private report</p>',
			projectId: s.projectId,
			title: 'Private report',
		});
		await directMember(s, s.member.userId, false);
		await expect(
			s.member.caller.mutation(api.feedback.toggleUpvote, { feedbackId: created.feedbackId })
		).rejects.toThrow('FORBIDDEN');
		await directMember(s, s.member.userId);
		await s.owner.caller.mutation(api.policy.updateProject, {
			projectId: s.projectId,
			visibility: 'archived',
		});
		await expect(
			s.member.caller.mutation(api.feedbackComments.create, {
				feedbackId: created.feedbackId,
				content: '<p>Too late</p>',
			})
		).rejects.toThrow('FORBIDDEN');
		await expect(
			s.owner.caller.mutation(api.feedback.updatePriority, {
				feedbackId: created.feedbackId,
				priority: 'urgent',
			})
		).rejects.toThrow('PROJECT_ARCHIVED');
	});

	test('persists native metadata, answers, follows and symmetric relations with the legacy rules', async () => {
		const s = await fixture();
		await directMember(s, s.member.userId);
		await assignedModerator(s);
		const first = await s.member.caller.mutation(api.feedback.create, {
			boardId: s.boards[0].id,
			firstComment: '<p>Initial</p>',
			projectId: s.projectId,
			title: 'First',
		});
		const second = await s.member.caller.mutation(api.feedback.create, {
			boardId: s.boards[1].id,
			firstComment: '<p>Related</p>',
			projectId: s.projectId,
			title: 'Second',
		});
		const answer = await s.moderator.caller.mutation(api.feedbackComments.create, {
			feedbackId: first.feedbackId,
			content: '<p>Solved</p>',
		});

		await s.member.caller.mutation(api.feedback.updateTitle, {
			feedbackId: first.feedbackId,
			title: 'Renamed',
		});
		await s.member.caller.mutation(api.feedback.updateBoard, {
			feedbackId: first.feedbackId,
			boardId: s.boards[1].id,
		});
		await s.member.caller.mutation(api.feedback.setAnswerComment, {
			feedbackId: first.feedbackId,
			commentId: answer.id,
		});
		expect(
			await s.member.caller.mutation(api.feedback.toggleFollow, {
				feedbackId: first.feedbackId,
			})
		).toEqual({ following: true });
		await s.moderator.caller.mutation(api.feedback.updateAssigned, {
			feedbackId: first.feedbackId,
			assignedProfileId: s.moderator.profileId,
		});
		await s.moderator.caller.mutation(api.feedback.updateTarget, {
			feedbackId: first.feedbackId,
			target: '2026-Q4',
			targetGranularity: 'quarter',
		});
		await s.moderator.caller.mutation(api.feedback.updateTags, {
			feedbackId: first.feedbackId,
			tags: [' UX ', 'feature-request', 'ux'],
		});
		await s.moderator.caller.mutation(api.feedback.addRelation, {
			feedbackId: first.feedbackId,
			relatedFeedbackId: second.feedbackId,
		});

		const detail = await s.member.caller.query(api.feedback.getDetail, {
			projectId: s.projectId,
			slug: first.slug,
		});
		expect(detail).toMatchObject({
			assignedProfile: { id: s.moderator.profileId },
			feedback: {
				answerCommentId: answer.id,
				boardId: s.boards[1].id,
				tags: ['ux', 'feature-request'],
				target: '2026-Q4',
				targetGranularity: 'quarter',
				title: 'Renamed',
			},
			following: true,
			related: [{ id: second.feedbackId }],
		});
		const reverse = await s.member.caller.query(api.feedback.getDetail, {
			projectId: s.projectId,
			slug: second.slug,
		});
		expect(reverse?.related).toEqual([
			expect.objectContaining({ id: first.feedbackId, title: 'Renamed' }),
		]);
		await expect(
			s.member.caller.mutation(api.feedback.updateTags, {
				feedbackId: first.feedbackId,
				tags: ['forbidden'],
			})
		).rejects.toThrow('FORBIDDEN');
	});

	test('paginates one ordered timeline and deletes all bounded feedback descendants', async () => {
		const s = await fixture();
		await directMember(s, s.member.userId);
		const created = await s.member.caller.mutation(api.feedback.create, {
			boardId: s.boards[0].id,
			firstComment: '<p>Initial</p>',
			projectId: s.projectId,
			title: 'Long thread',
		});
		for (let index = 0; index < 24; index += 1) {
			await s.member.caller.mutation(api.feedbackComments.create, {
				feedbackId: created.feedbackId,
				content: `<p>Comment ${index}</p>`,
			});
		}
		const detail = await s.member.caller.query(api.feedback.getDetail, {
			projectId: s.projectId,
			slug: created.slug,
		});
		expect(detail?.timeline).toHaveLength(20);
		expect(detail?.timelineCursor).toBeTruthy();
		expect(
			detail?.timeline.map((item) =>
				item.type === 'comment' ? item.data.content : item.data.eventType
			)
		).toEqual(Array.from({ length: 20 }, (_, index) => `<p>Comment ${index + 4}</p>`));
		const tail = await s.member.caller.query(api.feedback.listTimelinePage, {
			feedbackId: created.feedbackId,
			paginationOpts: { cursor: detail!.timelineCursor, numItems: 20 },
		});
		expect(tail?.page).toHaveLength(4);
		expect(
			tail?.page.map((item) => (item.type === 'comment' ? item.data.content : item.data.eventType))
		).toEqual(Array.from({ length: 4 }, (_, index) => `<p>Comment ${index}</p>`));
		expect(tail?.isDone).toBe(true);

		await s.owner.caller.mutation(api.feedback.remove, { feedbackId: created.feedbackId });
		const remaining = await s.t.run(async (ctx) => ({
			comments: await ctx.db
				.query('feedbackComments')
				.withIndex('by_feedbackId', (q) => q.eq('feedbackId', created.feedbackId))
				.collect(),
			feedback: await ctx.db.get('feedback', created.feedbackId),
			timeline: await ctx.db
				.query('feedbackTimelineEntries')
				.withIndex('by_feedbackId', (q) => q.eq('feedbackId', created.feedbackId))
				.collect(),
		}));
		expect(remaining).toEqual({ comments: [], feedback: null, timeline: [] });
	});

	test('continues a large feedback cascade through a resumable scheduled job', async () => {
		const s = await fixture();
		const created = await s.owner.caller.mutation(api.feedback.create, {
			boardId: s.boards[0].id,
			firstComment: '<p>Initial</p>',
			projectId: s.projectId,
			title: 'Large thread',
		});
		for (let index = 0; index < 110; index += 1) {
			await s.owner.caller.mutation(api.feedbackComments.create, {
				feedbackId: created.feedbackId,
				content: `<p>Comment ${index}</p>`,
			});
		}
		vi.useFakeTimers();
		await s.owner.caller.mutation(api.feedback.remove, { feedbackId: created.feedbackId });
		expect(
			await s.owner.caller.query(api.feedback.getDetail, {
				projectId: s.projectId,
				slug: created.slug,
			})
		).toBeNull();
		await s.t.finishAllScheduledFunctions(vi.runAllTimers);
		vi.useRealTimers();
		expect(await s.t.run((ctx) => ctx.db.get('feedback', created.feedbackId))).toBeNull();
		expect(
			await s.t.run((ctx) =>
				ctx.db
					.query('feedbackDeletionJobs')
					.withIndex('by_feedbackId', (q) => q.eq('feedbackId', created.feedbackId))
					.collect()
			)
		).toEqual([]);
	});
});
