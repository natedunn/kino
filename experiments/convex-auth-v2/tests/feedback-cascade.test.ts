// @vitest-environment edge-runtime
import type { Id } from '../relationships/convex/_generated/dataModel';

import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { afterEach, expect, test, vi } from 'vitest';

import schema from '../relationships/convex/schema';

const modules = import.meta.glob('../relationships/convex/**/*.{ts,js}');
const m = (name: string) => makeFunctionReference<'mutation'>(name);
const q = (name: string) => makeFunctionReference<'query'>(name);
afterEach(() => vi.useRealTimers());
async function setup() {
	vi.useFakeTimers();
	const t = convexTest(schema, modules);
	const users = await t.run(async (ctx) =>
		Promise.all([
			ctx.db.insert('users', { verified: true }),
			ctx.db.insert('users', { verified: true }),
		])
	);
	const organizations = await t.run(async (ctx) =>
		Promise.all(users.map((ownerId) => ctx.db.insert('organizations', { ownerId })))
	);
	const owner = t.withIdentity({ subject: users[0] }),
		outsider = t.withIdentity({ subject: users[1] });
	const project = await owner.mutation(m('feedbackSlice:createProject'), {
		organizationId: organizations[0],
	});
	const otherProject = await outsider.mutation(m('feedbackSlice:createProject'), {
		organizationId: organizations[1],
	});
	const boards = await owner.query(q('lifecycle:read'), { projectId: project });
	const repository = await owner.mutation(m('feedbackSlice:connectRepository'), {
		projectId: project,
		remoteId: 'repo-a',
	});
	const create = (boardId = boards[0]._id) =>
		owner.mutation(m('feedbackSlice:create'), {
			boardId,
			title: 'Feedback',
			content: 'Initial text',
		});
	return { t, owner, outsider, project, otherProject, boards, repository, create };
}
test('project defaults, initial-comment search updates, and idempotent vote counter survive native writes', async () => {
	const s = await setup();
	expect(s.boards.map((b: { name: string }) => b.name)).toEqual([
		'Bugs',
		'Feature Requests',
		'Improvements',
	]);
	const f = await s.create();
	await s.owner.mutation(m('feedbackSlice:editComment'), {
		commentId: f.commentId,
		content: 'Changed text',
	});
	for (let i = 0; i < 3; i++)
		await s.owner.mutation(m('feedbackSlice:setVote'), { feedbackId: f.feedbackId, enabled: true });
	expect(await s.t.run((ctx) => ctx.db.get(f.feedbackId))).toMatchObject({
		upvotes: 1,
		searchContent: 'Feedback Changed text',
		firstCommentId: f.commentId,
	});
	await s.owner.mutation(m('feedbackSlice:setVote'), { feedbackId: f.feedbackId, enabled: false });
	await s.owner.mutation(m('feedbackSlice:setVote'), { feedbackId: f.feedbackId, enabled: false });
	expect(await s.t.run((ctx) => ctx.db.get(f.feedbackId))).toMatchObject({ upvotes: 0 });
	await expect(
		s.owner.mutation(m('branchDeletion:begin'), { kind: 'comment', rootId: f.commentId })
	).rejects.toThrow('INITIAL_COMMENT');
	await expect(
		s.owner.mutation(m('lifecycle:removeComment'), { commentId: f.commentId })
	).rejects.toThrow('INITIAL_COMMENT');
});
test('large board cascade cleans feedback/comments/reactions/votes/events/GitHub links without deleting repositories or sibling scopes', async () => {
	const s = await setup();
	const sibling = await s.create(s.boards[1]._id);
	for (let i = 0; i < 37; i++) {
		const f = await s.create();
		const commentId = await s.owner.mutation(m('lifecycle:createComment'), {
			projectId: s.project,
			feedbackId: f.feedbackId,
		});
		for (let r = 0; r < 9; r++) await s.owner.mutation(m('lifecycle:react'), { commentId });
		await s.owner.mutation(m('feedbackSlice:setVote'), { feedbackId: f.feedbackId, enabled: true });
		await s.owner.mutation(m('feedbackSlice:event'), { feedbackId: f.feedbackId, kind: 'status' });
		await s.owner.mutation(m('feedbackSlice:link'), {
			feedbackId: f.feedbackId,
			repositoryId: s.repository,
			remoteId: String(i),
		});
	}
	const jobId: Id<'branchJobs'> = await s.owner.mutation(m('branchDeletion:begin'), {
		kind: 'board',
		rootId: s.boards[0]._id,
	});
	await s.t.mutation(m('branchDeletion:step'), { jobId, version: 0 });
	expect(await s.t.run((ctx) => ctx.db.get(jobId))).toMatchObject({ processed: 25, version: 1 });
	await s.t.finishAllScheduledFunctions(vi.runAllTimers);
	expect(await s.t.run((ctx) => ctx.db.get(jobId))).toMatchObject({ done: true, processed: 555 });
	for (const table of ['feedback', 'comments', 'reactions', 'votes', 'events', 'links'] as const)
		expect(
			await s.t.run((ctx) =>
				ctx.db
					.query(table)
					.withIndex('by_boardId', (q) => q.eq('boardId', s.boards[0]._id))
					.collect()
			)
		).toEqual([]);
	expect(await s.t.run((ctx) => ctx.db.get(s.repository))).not.toBeNull();
	expect(await s.t.run((ctx) => ctx.db.get(sibling.feedbackId))).not.toBeNull();
	expect(await s.outsider.query(q('lifecycle:read'), { projectId: s.otherProject })).toHaveLength(
		3
	);
});
test('feedback-only deletion removes all children but preserves siblings and repository connection', async () => {
	const s = await setup();
	const f = await s.create(),
		keep = await s.create();
	await s.owner.mutation(m('feedbackSlice:setVote'), { feedbackId: f.feedbackId, enabled: true });
	await s.owner.mutation(m('feedbackSlice:event'), {
		feedbackId: f.feedbackId,
		kind: 'assignment',
	});
	await s.owner.mutation(m('feedbackSlice:link'), {
		feedbackId: f.feedbackId,
		repositoryId: s.repository,
		remoteId: 'issue',
	});
	await s.owner.mutation(m('branchDeletion:begin'), { kind: 'feedback', rootId: f.feedbackId });
	await s.t.finishAllScheduledFunctions(vi.runAllTimers);
	for (const table of ['comments', 'reactions', 'votes', 'events', 'links'] as const)
		expect(
			await s.t.run((ctx) =>
				ctx.db
					.query(table)
					.withIndex('by_feedbackId', (q) => q.eq('feedbackId', f.feedbackId))
					.collect()
			)
		).toEqual([]);
	expect(await s.t.run((ctx) => ctx.db.get(f.feedbackId))).toBeNull();
	expect(await s.t.run((ctx) => ctx.db.get(keep.feedbackId))).not.toBeNull();
	expect(await s.t.run((ctx) => ctx.db.get(s.repository))).not.toBeNull();
});
test('large comment deletion hides answer immediately, clears references in batches and preserves replies', async () => {
	const s = await setup();
	const f = await s.create();
	const commentId = await s.owner.mutation(m('lifecycle:createComment'), {
		projectId: s.project,
		feedbackId: f.feedbackId,
	});
	await s.owner.mutation(m('lifecycle:answer'), { feedbackId: f.feedbackId, commentId });
	for (let i = 0; i < 61; i++) {
		await s.owner.mutation(m('lifecycle:react'), { commentId });
		await s.owner.mutation(m('lifecycle:createComment'), {
			projectId: s.project,
			feedbackId: f.feedbackId,
			replyId: commentId,
		});
	}
	const jobId: Id<'branchJobs'> = await s.owner.mutation(m('branchDeletion:begin'), {
		kind: 'comment',
		rootId: commentId,
	});
	expect(
		(await s.owner.query(q('feedbackSlice:read'), { feedbackId: f.feedbackId })).answerId
	).toBeNull();
	await expect(s.owner.mutation(m('lifecycle:react'), { commentId })).rejects.toThrow('DELETING');
	await s.t.finishAllScheduledFunctions(vi.runAllTimers);
	expect(await s.t.run((ctx) => ctx.db.get(jobId))).toMatchObject({ done: true, processed: 123 });
	expect(await s.t.run((ctx) => ctx.db.get(f.feedbackId))).not.toHaveProperty('answerId');
	expect(
		await s.t.run((ctx) =>
			ctx.db
				.query('comments')
				.withIndex('by_feedbackId', (q) => q.eq('feedbackId', f.feedbackId))
				.collect()
		)
	).toHaveLength(62);
	expect(
		await s.t.run((ctx) =>
			ctx.db
				.query('comments')
				.withIndex('by_replyId', (q) => q.eq('replyId', commentId))
				.collect()
		)
	).toEqual([]);
});
test('deletion fences deny every feedback write path and distinguish write-before/delete-before ordering', async () => {
	const s = await setup();
	const f = await s.create();
	// A write committed before the fence is included in the purge.
	await s.owner.mutation(m('feedbackSlice:event'), { feedbackId: f.feedbackId, kind: 'status' });
	await s.owner.mutation(m('branchDeletion:begin'), { kind: 'board', rootId: s.boards[0]._id });
	const attempts = [
		['feedbackSlice:create', { boardId: s.boards[0]._id, title: 'late', content: '' }],
		['lifecycle:createFeedback', { projectId: s.project, boardId: s.boards[0]._id }],
		['lifecycle:createComment', { projectId: s.project, feedbackId: f.feedbackId }],
		['feedbackSlice:editComment', { commentId: f.commentId, content: 'late' }],
		['feedbackSlice:setVote', { feedbackId: f.feedbackId, enabled: true }],
		['feedbackSlice:event', { feedbackId: f.feedbackId, kind: 'status' }],
		[
			'feedbackSlice:link',
			{ feedbackId: f.feedbackId, repositoryId: s.repository, remoteId: 'late' },
		],
		['lifecycle:react', { commentId: f.commentId }],
		['lifecycle:answer', { feedbackId: f.feedbackId, commentId: f.commentId }],
	] as const;
	for (const [name, args] of attempts)
		await expect(s.owner.mutation(m(name), args)).rejects.toThrow('DELETING');
	await expect(
		s.owner.query(q('feedbackSlice:read'), { feedbackId: f.feedbackId })
	).rejects.toThrow('DELETING');
	await s.t.finishAllScheduledFunctions(vi.runAllTimers);
	expect(await s.t.run((ctx) => ctx.db.query('events').collect())).toEqual([]);
});
test('interrupted scheduling resumes from durable progress; duplicate and future step versions are no-ops', async () => {
	const s = await setup();
	const f = await s.create();
	for (let i = 0; i < 60; i++)
		await s.owner.mutation(m('lifecycle:react'), { commentId: f.commentId });
	const jobId: Id<'branchJobs'> = await s.owner.mutation(m('branchDeletion:begin'), {
		kind: 'feedback',
		rootId: f.feedbackId,
	});
	await s.t.run(async (ctx) => {
		const job = await ctx.db.get(jobId);
		await ctx.scheduler.cancel(job!.scheduledId!);
	});
	await s.t.mutation(m('branchDeletion:step'), { jobId, version: 0 });
	await s.t.run(async (ctx) => {
		const job = await ctx.db.get(jobId);
		await ctx.scheduler.cancel(job!.scheduledId!);
	});
	await s.t.finishAllScheduledFunctions(vi.runAllTimers);
	expect(await s.t.run((ctx) => ctx.db.get(jobId))).toMatchObject({
		done: false,
		processed: 25,
		version: 1,
	});
	await s.t.mutation(m('branchDeletion:step'), { jobId, version: 0 });
	await s.t.mutation(m('branchDeletion:step'), { jobId, version: 99 });
	expect(await s.t.run((ctx) => ctx.db.get(jobId))).toMatchObject({ processed: 25, version: 1 });
	await expect(s.outsider.mutation(m('branchDeletion:resume'), { jobId })).rejects.toThrow(
		'FORBIDDEN'
	);
	await s.owner.mutation(m('branchDeletion:resume'), { jobId });
	await s.owner.mutation(m('branchDeletion:resume'), { jobId });
	await s.t.finishAllScheduledFunctions(vi.runAllTimers);
	expect(await s.t.run((ctx) => ctx.db.get(jobId))).toMatchObject({ done: true, processed: 61 });
});
test('failed transaction rolls back child deletion, progress and scheduled continuation', async () => {
	const s = await setup();
	const f = await s.create();
	await s.owner.mutation(m('lifecycle:react'), { commentId: f.commentId });
	const jobId: Id<'branchJobs'> = await s.owner.mutation(m('branchDeletion:begin'), {
		kind: 'feedback',
		rootId: f.feedbackId,
	});
	await expect(
		s.t.run(async (ctx) => {
			await ctx.runMutation(m('branchDeletion:step'), { jobId, version: 0 });
			throw new Error('Injected transaction failure');
		})
	).rejects.toThrow('Injected transaction failure');
	expect(await s.t.run((ctx) => ctx.db.get(jobId))).toMatchObject({ processed: 0, version: 0 });
	expect(await s.t.run((ctx) => ctx.db.query('reactions').collect())).toHaveLength(1);
	await s.t.finishAllScheduledFunctions(vi.runAllTimers);
	expect(await s.t.run((ctx) => ctx.db.get(jobId))).toMatchObject({ done: true });
});
test('overlapping comment/feedback/board/project purges converge without crossing organizations', async () => {
	const s = await setup();
	const f = await s.create();
	const commentId = await s.owner.mutation(m('lifecycle:createComment'), {
		projectId: s.project,
		feedbackId: f.feedbackId,
	});
	const commentJob = await s.owner.mutation(m('branchDeletion:begin'), {
		kind: 'comment',
		rootId: commentId,
	});
	const feedbackJob = await s.owner.mutation(m('branchDeletion:begin'), {
		kind: 'feedback',
		rootId: f.feedbackId,
	});
	const boardJob = await s.owner.mutation(m('branchDeletion:begin'), {
		kind: 'board',
		rootId: s.boards[0]._id,
	});
	await s.owner.mutation(m('lifecycle:beginDelete'), { projectId: s.project });
	await s.t.finishAllScheduledFunctions(vi.runAllTimers);
	for (const jobId of [commentJob, feedbackJob, boardJob])
		expect(await s.t.run((ctx) => ctx.db.get(jobId))).toMatchObject({ done: true });
	expect(await s.t.run((ctx) => ctx.db.get(s.project))).toBeNull();
	expect(await s.outsider.query(q('lifecycle:read'), { projectId: s.otherProject })).toHaveLength(
		3
	);
});
test('anonymous and other organization cannot delete roots, and foreign repository cannot be linked', async () => {
	const s = await setup();
	const f = await s.create();
	for (const client of [s.t, s.outsider])
		for (const [kind, rootId] of [
			['board', s.boards[0]._id],
			['feedback', f.feedbackId],
			['comment', f.commentId],
		])
			await expect(client.mutation(m('branchDeletion:begin'), { kind, rootId })).rejects.toThrow(
				'FORBIDDEN'
			);
	const repositoryId = await s.outsider.mutation(m('feedbackSlice:connectRepository'), {
		projectId: s.otherProject,
		remoteId: 'foreign',
	});
	await expect(
		s.owner.mutation(m('feedbackSlice:link'), {
			feedbackId: f.feedbackId,
			repositoryId,
			remoteId: 'x',
		})
	).rejects.toThrow('INVALID_PARENT');
});
