// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { beforeEach, expect, test, vi } from 'vitest';

import { configureTestAuth, issuer } from '../testing/setup.testing';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.testing.ts']);
beforeEach(configureTestAuth);
async function fixture() {
	const t = convexTest(schema, modules);
	const data = await t.run(async (ctx) => {
		const owner = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const outsider = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const profile = await ctx.db.insert('profiles', {
			userId: owner,
			username: 'owner',
			name: 'Owner',
		});
		await ctx.db.patch('users', owner, { profileId: profile });
		const organizationId = await ctx.db.insert('organizations', {
			name: 'Boards',
			slug: 'boards',
			visibility: 'public',
		});
		await ctx.db.insert('memberships', { organizationId, userId: owner, role: 'owner' });
		const projectId = await ctx.db.insert('projects', {
			organizationId,
			name: 'Project',
			slug: 'project',
			visibility: 'private',
		});
		return { owner, outsider, profile, projectId };
	});
	return {
		t,
		...data,
		ownerClient: t.withIdentity({ issuer, subject: data.owner }),
		outsiderClient: t.withIdentity({ issuer, subject: data.outsider }),
	};
}

test('board CRUD validates values, scopes reads and mutations, and preserves identity during rename', async () => {
	const s = await fixture();
	const create = { projectId: s.projectId, name: 'Bugs', slug: 'bugs', description: 'Before' };
	await expect(s.outsiderClient.mutation(api.feedbackBoards.create, create)).rejects.toThrow();
	await expect(
		s.ownerClient.mutation(api.feedbackBoards.create, {
			...create,
			description: 'x'.repeat(10_000),
		})
	).rejects.toThrow('BAD_REQUEST');
	const id = await s.ownerClient.mutation(api.feedbackBoards.create, create);
	const other = await s.ownerClient.mutation(api.feedbackBoards.create, {
		...create,
		name: 'Other',
		slug: 'other',
	});
	await expect(s.ownerClient.mutation(api.feedbackBoards.create, create)).rejects.toThrow(
		'CONFLICT'
	);
	const args = { id, orgSlug: 'boards', projectSlug: 'project' };
	await expect(
		s.ownerClient.mutation(api.feedbackBoards.update, { ...args, name: 'Conflict', slug: 'other' })
	).rejects.toThrow('CONFLICT');
	expect(await s.ownerClient.query(api.feedbackBoards.get, args)).toMatchObject({
		slug: 'bugs',
		name: 'Bugs',
	});
	const secondProject = await s.t.run(async (ctx) => {
		const project = await ctx.db.get('projects', s.projectId);
		return ctx.db.insert('projects', {
			organizationId: project!.organizationId,
			name: 'Second',
			slug: 'second',
			visibility: 'public',
		});
	});
	await expect(
		s.ownerClient.mutation(api.feedbackBoards.remove, { boardId: other, projectId: secondProject })
	).rejects.toThrow('NOT_FOUND');
	expect(await s.t.query(api.feedbackBoards.get, args)).toBeNull();
	expect(
		await s.ownerClient.query(api.feedbackBoards.get, { ...args, orgSlug: 'wrong' })
	).toBeNull();
	await expect(
		s.outsiderClient.mutation(api.feedbackBoards.update, { ...args, name: 'Bad', slug: 'bad' })
	).rejects.toThrow();
	await s.ownerClient.mutation(api.feedbackBoards.update, {
		...args,
		name: 'Renamed',
		slug: 'renamed',
		description: '',
	});
	expect(await s.ownerClient.query(api.feedbackBoards.get, args)).toMatchObject({
		id,
		name: 'Renamed',
		slug: 'renamed',
		description: null,
	});
	await s.t.run((ctx) => ctx.db.patch('projects', s.projectId, { visibility: 'archived' }));
	await expect(
		s.ownerClient.mutation(api.feedbackBoards.update, { ...args, name: 'Nope', slug: 'nope' })
	).rejects.toThrow('PROJECT_ARCHIVED');
	await expect(
		s.ownerClient.mutation(api.feedbackBoards.remove, { boardId: id, projectId: s.projectId })
	).rejects.toThrow('PROJECT_ARCHIVED');
});

test('board removal fences immediately and drains high-fanout children and both relation directions without touching other boards', async () => {
	vi.useFakeTimers();
	try {
		const s = await fixture();
		const boardId = await s.ownerClient.mutation(api.feedbackBoards.create, {
			projectId: s.projectId,
			name: 'Delete',
			slug: 'delete-board',
		});
		const keepBoard = await s.ownerClient.mutation(api.feedbackBoards.create, {
			projectId: s.projectId,
			name: 'Keep',
			slug: 'keep',
		});
		const ids = await s.t.run(async (ctx) => {
			const insert = (board: typeof boardId, slug: string) =>
				ctx.db.insert('feedback', {
					projectId: s.projectId,
					boardId: board,
					authorProfileId: s.profile,
					slug,
					title: slug,
					status: 'open',
					priority: 'none',
					upvotes: 0,
					tags: [],
					searchContent: slug,
					updatedAt: 1,
				});
			const doomed = await insert(boardId, 'doomed');
			const kept = await insert(keepBoard, 'kept');
			for (let i = 0; i < 155; i++)
				await ctx.db.insert('feedbackUpvotes', { feedbackId: doomed, authorProfileId: s.profile });
			await ctx.db.insert('feedbackRelations', {
				projectId: s.projectId,
				createdByProfileId: s.profile,
				feedbackId: doomed,
				relatedFeedbackId: kept,
			});
			await ctx.db.insert('feedbackRelations', {
				projectId: s.projectId,
				createdByProfileId: s.profile,
				feedbackId: kept,
				relatedFeedbackId: doomed,
			});
			return { doomed, kept };
		});
		await s.ownerClient.mutation(api.feedbackBoards.remove, { boardId, projectId: s.projectId });
		expect(
			await s.ownerClient.query(api.feedbackBoards.get, {
				id: boardId,
				orgSlug: 'boards',
				projectSlug: 'project',
			})
		).toBeNull();
		expect(
			(await s.ownerClient.query(api.feedbackBoards.list, { projectId: s.projectId }))?.map(
				(b) => b.id
			)
		).toEqual([keepBoard]);
		await expect(
			s.ownerClient.mutation(api.feedbackBoards.update, {
				id: boardId,
				orgSlug: 'boards',
				projectSlug: 'project',
				name: 'Revive',
				slug: 'revive',
			})
		).rejects.toThrow('NOT_FOUND');
		// Explicit batches also prove idempotent replay independently of scheduler timing.
		for (let i = 0; i < 8; i++) await s.t.mutation(internal.feedbackBoards.purge, { boardId });
		await s.t.finishAllScheduledFunctions(vi.runAllTimers);
		await s.t.run(async (ctx) => {
			expect(await ctx.db.get('feedbackBoards', boardId)).toBeNull();
			expect(await ctx.db.get('feedback', ids.doomed)).toBeNull();
			expect(await ctx.db.get('feedback', ids.kept)).not.toBeNull();
			expect(await ctx.db.query('feedbackUpvotes').collect()).toEqual([]);
			expect(await ctx.db.query('feedbackRelations').collect()).toEqual([]);
		});
	} finally {
		vi.useRealTimers();
	}
});
