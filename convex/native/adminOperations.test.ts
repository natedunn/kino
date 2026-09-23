// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { configureTestAuth, issuer } from '../testing/setup.testing';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.testing.ts']);

beforeEach(() => {
	configureTestAuth();
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-09-22T12:00:00.000Z'));
});
afterEach(() => vi.useRealTimers());

test('only system admins can inspect and resume stalled operational jobs', async () => {
	const t = convexTest(schema, modules);
	const ids = await t.run(async (ctx) => {
		const adminId = await ctx.db.insert('users', { status: 'active', systemRole: 'system:admin' });
		const outsiderId = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const organizationId = await ctx.db.insert('organizations', {
			name: 'Operations',
			slug: 'operations',
			visibility: 'private',
		});
		const projectId = await ctx.db.insert('projects', {
			name: 'Cleanup proof',
			organizationId,
			slug: 'cleanup-proof',
			visibility: 'private',
		});
		const boardId = await ctx.db.insert('feedbackBoards', {
			deletingAt: Date.now() - 6 * 60 * 1000,
			name: 'Deleting',
			projectId,
			slug: 'deleting',
		});
		const profileId = await ctx.db.insert('profiles', {
			name: 'Deleted author',
			userId: adminId,
			username: 'deleted-author',
		});
		const updateId = await ctx.db.insert('updates', {
			authorProfileId: profileId,
			category: 'changelog',
			commentCount: 0,
			content: 'Already removed',
			heartCount: 0,
			projectId,
			relatedFeedbackIds: [],
			searchContent: 'Already removed',
			slug: 'already-removed',
			status: 'draft',
			tags: [],
			title: 'Already removed',
			updatedAt: Date.now(),
		});
		const orphanedUpdateJobId = await ctx.db.insert('updateDeletionJobs', { updateId });
		await ctx.db.delete('updates', updateId);
		return { adminId, boardId, orphanedUpdateJobId, outsiderId };
	});
	const admin = t.withIdentity({ issuer, subject: ids.adminId });
	const outsider = t.withIdentity({ issuer, subject: ids.outsiderId });

	await expect(outsider.query(api.adminOperations.list, {})).rejects.toThrow('FORBIDDEN');
	await expect(
		outsider.mutation(api.adminOperations.resume, {
			job: { kind: 'board_deletion', jobId: ids.boardId },
		})
	).rejects.toThrow('FORBIDDEN');

	await expect(admin.query(api.adminOperations.list, {})).resolves.toEqual(
		expect.arrayContaining([
			{
				attempt: null,
				createdAt: expect.any(Number),
				jobId: ids.orphanedUpdateJobId,
				kind: 'update_deletion',
				lastError: null,
				maxAttempt: null,
				projectId: null,
				staleAfter: expect.any(Number),
				state: 'running',
				targetId: expect.any(String),
			},
			expect.objectContaining({ kind: 'board_deletion', jobId: ids.boardId, state: 'running' }),
		])
	);
	await admin.mutation(api.adminOperations.resume, {
		job: { kind: 'update_deletion', jobId: ids.orphanedUpdateJobId },
	});
	await admin.mutation(api.adminOperations.resume, {
		job: { kind: 'board_deletion', jobId: ids.boardId },
	});
	await t.finishAllScheduledFunctions(vi.runAllTimers);
	expect(await t.run((ctx) => ctx.db.get('feedbackBoards', ids.boardId))).toBeNull();
	expect(
		await t.run((ctx) => ctx.db.get('updateDeletionJobs', ids.orphanedUpdateJobId))
	).toBeNull();
});

test('system metrics count all accounts and return only five verified recent sign-ups', async () => {
	const t = convexTest(schema, modules);
	const identities = await t.run(async (ctx) => {
		const adminId = await ctx.db.insert('users', { status: 'active', systemRole: 'system:admin' });
		const ordinaryId = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		await ctx.db.insert('users', {
			status: 'pendingVerification',
			systemRole: 'user',
			passwordEmail: 'unverified@example.test',
		});
		await ctx.db.insert('users', { status: 'disabled', systemRole: 'user' });
		for (let index = 0; index < 5; index += 1) {
			const id = await ctx.db.insert('users', {
				status: 'active',
				systemRole: 'user',
				passwordEmail: `person${index}@example.test`,
				passwordEmailVerifiedAt: Date.now(),
			});
			const profileId = await ctx.db.insert('profiles', {
				userId: id,
				name: `Person ${index}`,
				username: `person${index}`,
			});
			await ctx.db.patch('users', id, { profileId });
		}
		const organizationId = await ctx.db.insert('organizations', {
			name: 'Metrics',
			slug: 'metrics',
			visibility: 'private',
		});
		const projectId = await ctx.db.insert('projects', {
			organizationId,
			name: 'Metrics',
			slug: 'metrics',
			visibility: 'private',
		});
		const boardId = await ctx.db.insert('feedbackBoards', {
			projectId,
			name: 'Ideas',
			slug: 'ideas',
		});
		const profileId = await ctx.db.insert('profiles', {
			userId: adminId,
			name: 'Admin',
			username: 'admin-metrics',
		});
		await ctx.db.insert('feedback', {
			projectId,
			boardId,
			authorProfileId: profileId,
			slug: 'first',
			title: 'First',
			status: 'open',
			priority: 'none',
			upvotes: 0,
			tags: [],
			searchContent: 'First',
			updatedAt: Date.now(),
		});
		return { adminId, ordinaryId };
	});
	const admin = t.withIdentity({ issuer, subject: identities.adminId });
	const ordinary = t.withIdentity({ issuer, subject: identities.ordinaryId });
	await expect(t.query(api.adminOperations.getSystemMetrics, {})).rejects.toThrow('UNAUTHORIZED');
	await expect(ordinary.query(api.adminOperations.getSystemMetrics, {})).rejects.toThrow(
		'FORBIDDEN'
	);
	const metrics = await admin.query(api.adminOperations.getSystemMetrics, {});
	expect(metrics.counts).toEqual({ users: 9, organizations: 1, projects: 1, feedback: 1 });
	expect(metrics.recentUsers).toHaveLength(5);
	expect(metrics.recentUsers.map((user) => user.name)).toEqual([
		'Person 4',
		'Person 3',
		'Person 2',
		'Person 1',
		'Person 0',
	]);
	expect(metrics.recentUsers[0]?.email).toBe('person4@example.test');
	expect(metrics.recentUsers.every((user) => user.createdAt > 0)).toBe(true);
});
