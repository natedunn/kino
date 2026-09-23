// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { afterEach, expect, test, vi } from 'vitest';

import schema from '../relationships/convex/schema';

const modules = import.meta.glob('../relationships/convex/**/*.{ts,js}');
const m = (name: string) => makeFunctionReference<'mutation'>(`lifecycle:${name}`);
const q = makeFunctionReference<'query'>('lifecycle:read');
afterEach(() => vi.useRealTimers());
async function setup() {
	vi.useFakeTimers();
	const t = convexTest(schema, modules);
	const ids = await t.run(async (ctx) =>
		Promise.all([
			ctx.db.insert('users', { verified: true }),
			ctx.db.insert('users', { verified: true }),
		])
	);
	const projects = await t.run(async (ctx) =>
		Promise.all(ids.map((ownerId) => ctx.db.insert('projects', { ownerId, deleting: false })))
	);
	const [owner, other] = ids.map((subject) => t.withIdentity({ subject }));
	const board = await owner.mutation(m('createBoard'), { projectId: projects[0], name: 'Bugs' });
	const feedback = await owner.mutation(m('createFeedback'), {
		projectId: projects[0],
		boardId: board,
	});
	const comment = await owner.mutation(m('createComment'), {
		projectId: projects[0],
		feedbackId: feedback,
	});
	return { t, owner, other, projects, board, feedback, comment };
}
test('relationship writes reject forged parents, cross-tenant actors and anonymous users', async () => {
	const s = await setup();
	const foreignBoard = await s.other.mutation(m('createBoard'), {
		projectId: s.projects[1],
		name: 'Foreign',
	});
	await expect(
		s.owner.mutation(m('createFeedback'), { projectId: s.projects[0], boardId: foreignBoard })
	).rejects.toThrow('INVALID_PARENT');
	for (const client of [s.t, s.other]) {
		await expect(client.mutation(m('beginDelete'), { projectId: s.projects[0] })).rejects.toThrow(
			'FORBIDDEN'
		);
		await expect(client.mutation(m('removeComment'), { commentId: s.comment })).rejects.toThrow(
			'FORBIDDEN'
		);
	}
	const otherFeedback = await s.other.mutation(m('createFeedback'), {
		projectId: s.projects[1],
		boardId: foreignBoard,
	});
	await expect(
		s.owner.mutation(m('createComment'), { projectId: s.projects[0], feedbackId: otherFeedback })
	).rejects.toThrow('INVALID_PARENT');
	await expect(
		s.owner.mutation(m('answer'), {
			feedbackId: s.feedback,
			commentId: await s.other.mutation(m('createComment'), {
				projectId: s.projects[1],
				feedbackId: otherFeedback,
			}),
		})
	).rejects.toThrow('INVALID_PARENT');
});
test('comment deletion cascades reactions and clears answer/reply pointers atomically', async () => {
	const s = await setup();
	const reply = await s.owner.mutation(m('createComment'), {
		projectId: s.projects[0],
		feedbackId: s.feedback,
		replyId: s.comment,
	});
	await s.owner.mutation(m('answer'), { feedbackId: s.feedback, commentId: s.comment });
	await s.owner.mutation(m('react'), { commentId: s.comment });
	await s.owner.mutation(m('removeComment'), { commentId: s.comment });
	expect(await s.t.run((ctx) => ctx.db.get(s.comment))).toBeNull();
	expect(await s.t.run((ctx) => ctx.db.query('reactions').collect())).toEqual([]);
	expect(await s.t.run((ctx) => ctx.db.get(reply))).not.toHaveProperty('replyId');
	expect(await s.t.run((ctx) => ctx.db.get(s.feedback))).not.toHaveProperty('answerId');
});
test('large direct comment cascade rejects without partial pointer cleanup', async () => {
	const s = await setup();
	await s.owner.mutation(m('answer'), { feedbackId: s.feedback, commentId: s.comment });
	for (let i = 0; i < 26; i++) await s.owner.mutation(m('react'), { commentId: s.comment });
	await expect(s.owner.mutation(m('removeComment'), { commentId: s.comment })).rejects.toThrow(
		'REQUIRES_BATCH_JOB'
	);
	expect(await s.t.run((ctx) => ctx.db.get(s.feedback))).toMatchObject({ answerId: s.comment });
	expect(await s.t.run((ctx) => ctx.db.query('reactions').collect())).toHaveLength(26);
});
test('folder restrict behavior rejects non-empty deletion and cross-project parent', async () => {
	const s = await setup();
	const parent = await s.owner.mutation(m('createFolder'), { projectId: s.projects[0] });
	const child = await s.owner.mutation(m('createFolder'), {
		projectId: s.projects[0],
		parentId: parent,
	});
	await expect(s.owner.mutation(m('removeFolder'), { folderId: parent })).rejects.toThrow(
		'FOLDER_NOT_EMPTY'
	);
	await expect(
		s.other.mutation(m('createFolder'), { projectId: s.projects[1], parentId: parent })
	).rejects.toThrow('INVALID_PARENT');
	await s.owner.mutation(m('removeFolder'), { folderId: child });
	await s.owner.mutation(m('removeFolder'), { folderId: parent });
	expect(await s.t.run((ctx) => ctx.db.query('folders').collect())).toEqual([]);
});
test('delete fence blocks reads/writes; bounded jobs survive duplicate/reordered steps and leave other projects intact', async () => {
	const s = await setup();
	for (let i = 0; i < 81; i++) await s.owner.mutation(m('react'), { commentId: s.comment });
	const foreignBoard = await s.other.mutation(m('createBoard'), {
		projectId: s.projects[1],
		name: 'Keep me',
	});
	const jobId = await s.owner.mutation(m('beginDelete'), { projectId: s.projects[0] });
	expect(await s.owner.mutation(m('beginDelete'), { projectId: s.projects[0] })).toBe(jobId);
	await expect(s.owner.query(q, { projectId: s.projects[0] })).rejects.toThrow('DELETING');
	await expect(
		s.owner.mutation(m('createBoard'), { projectId: s.projects[0], name: 'Late write' })
	).rejects.toThrow('DELETING');
	await s.t.mutation(m('step'), { jobId, version: 0 });
	expect(await s.t.run((ctx) => ctx.db.get(jobId))).toMatchObject({ processed: 25, version: 1 });
	await s.t.mutation(m('step'), { jobId, version: 0 });
	await s.t.mutation(m('step'), { jobId, version: 99 });
	expect(await s.t.run((ctx) => ctx.db.get(jobId))).toMatchObject({ processed: 25, version: 1 });
	await s.t.finishAllScheduledFunctions(vi.runAllTimers);
	expect(await s.t.run((ctx) => ctx.db.get(jobId))).toMatchObject({ done: true, processed: 84 });
	expect(await s.t.run((ctx) => ctx.db.get(s.projects[0]))).toBeNull();
	expect(await s.t.run((ctx) => ctx.db.get(foreignBoard))).not.toBeNull();
	for (const table of ['boards', 'feedback', 'comments', 'reactions', 'folders'] as const)
		expect(
			await s.t.run((ctx) =>
				ctx.db
					.query(table)
					.withIndex('by_projectId', (q) => q.eq('projectId', s.projects[0]))
					.collect()
			)
		).toEqual([]);
	await s.t.mutation(m('step'), { jobId, version: 1 });
	expect(await s.t.run((ctx) => ctx.db.get(jobId))).toMatchObject({ done: true, processed: 84 });
});
test('internal purge refuses active project even if a malformed job exists', async () => {
	const s = await setup();
	const jobId = await s.t.run(async (ctx) => {
		const project = await ctx.db.get(s.projects[0]);
		return ctx.db.insert('jobs', {
			projectId: s.projects[0],
			ownerId: project!.ownerId,
			phase: 0,
			version: 0,
			processed: 0,
			done: false,
		});
	});
	await expect(s.t.mutation(m('step'), { jobId, version: 0 })).rejects.toThrow(
		'INVALID_DELETION_FENCE'
	);
	expect(await s.t.run((ctx) => ctx.db.get(s.comment))).not.toBeNull();
});

test('owner can request duplicate resumes; outsiders cannot resume and completion stays idempotent', async () => {
	const s = await setup();
	const jobId = await s.owner.mutation(m('beginDelete'), { projectId: s.projects[0] });
	for (const client of [s.t, s.other])
		await expect(client.mutation(m('resume'), { jobId })).rejects.toThrow('FORBIDDEN');
	await s.owner.mutation(m('resume'), { jobId });
	await s.owner.mutation(m('resume'), { jobId });
	await s.t.finishAllScheduledFunctions(vi.runAllTimers);
	expect(await s.t.run((ctx) => ctx.db.get(jobId))).toMatchObject({ done: true, processed: 3 });
	await s.owner.mutation(m('resume'), { jobId });
	expect(await s.t.run((ctx) => ctx.db.get(jobId))).toMatchObject({ done: true, processed: 3 });
});
