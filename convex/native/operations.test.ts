// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { configureTestAuth, issuer } from '../testing/setup.testing';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.testing.ts']);

beforeEach(() => {
	configureTestAuth();
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-09-22T12:00:00.000Z'));
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

test('operational alerts use the configured Bento recipient without exposing credentials', async () => {
	const t = convexTest(schema, modules);
	for (const key of ['BENTO_PUBLISHABLE_KEY', 'BENTO_SECRET_KEY', 'BENTO_SITE_UUID', 'BENTO_FROM'])
		vi.stubEnv(key, 'test-only');
	vi.stubEnv('NATIVE_OPERATIONS_ALERT_EMAIL', 'operator@example.test');
	const requests: Array<{ html_body: string; subject: string; to: string }> = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (_url: unknown, options: RequestInit) => {
			requests.push(...JSON.parse(options.body as string).emails);
			return new Response(JSON.stringify({ results: 1 }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		})
	);
	const alertId = await t.run((ctx) =>
		ctx.db.insert('operationalAlerts', {
			attempt: 0,
			deliveryStatus: 'pending',
			firstSeenAt: Date.now(),
			jobId: 'job<&',
			key: 'board_deletion:job<&',
			kind: 'board_deletion',
			lastSeenAt: Date.now(),
			state: 'stalled',
			targetId: 'target<&',
		})
	);
	await t.action(internal.operationsMail.deliver, { alertId, attempt: 0 });
	expect(requests).toHaveLength(1);
	expect(requests[0]).toMatchObject({
		subject: '[Kino operations] board deletion is stalled',
		to: 'operator@example.test',
	});
	expect(requests[0]?.html_body).toContain('target&lt;&amp;');
	expect(requests[0]?.html_body).not.toContain('test-only');
	expect(await t.run((ctx) => ctx.db.get('operationalAlerts', alertId))).toMatchObject({
		deliveryStatus: 'accepted',
		lastSentAt: expect.any(Number),
	});
});

test('alerts are deduplicated, delivered once per incident, resolved, and retained for 90 days', async () => {
	const t = convexTest(schema, modules);
	const ids = await t.run(async (ctx) => {
		const userId = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const organizationId = await ctx.db.insert('organizations', {
			name: 'Operations',
			slug: 'operations-alerts',
			visibility: 'private',
		});
		const projectId = await ctx.db.insert('projects', {
			name: 'Alerts',
			organizationId,
			slug: 'alerts',
			visibility: 'private',
		});
		const boardId = await ctx.db.insert('feedbackBoards', {
			deletingAt: Date.now() - 6 * 60_000,
			name: 'Deleting',
			projectId,
			slug: 'deleting-alert',
		});
		const assetId = await ctx.db.insert('fileAssets', {
			access: 'private_user',
			category: 'image',
			extension: 'png',
			listing: 'unlisted',
			name: 'old.png',
			normalizedName: 'old.png',
			origin: 'files',
			projectId,
			publicId: 'a'.repeat(32),
			searchContent: 'old png',
			state: 'deleted',
			updatedAt: Date.now(),
			uploaderClass: 'user',
			uploaderId: userId,
		});
		const objectId = await ctx.db.insert('fileObjects', {
			accounting: 'released',
			assetId,
			declaredBytes: 1,
			expiresAt: Date.now(),
			key: 'old',
			maxBytes: 1,
			mimeType: 'image/png',
			projectId,
			settleAfter: Date.now(),
			stagingKey: 'old-stage',
			state: 'deleted',
		});
		const cleanupId = await ctx.db.insert('storageCleanupJobs', {
			attempt: 1,
			finishedAt: Date.now() - 31 * 24 * 60 * 60_000,
			leaseUntil: 0,
			maxAttempt: 3,
			notBefore: 0,
			objectId,
			projectId,
			stagingOnly: false,
			state: 'done',
		});
		return { boardId, cleanupId };
	});

	await expect(t.mutation(internal.operations.scanAlerts, {})).resolves.toMatchObject({
		active: 1,
		created: 1,
	});
	await t.finishAllScheduledFunctions(vi.runAllTimers);
	let alerts = await t.run((ctx) => ctx.db.query('operationalAlerts').collect());
	expect(alerts).toHaveLength(1);
	expect(alerts[0]).toMatchObject({
		deliveryStatus: 'disabled',
		kind: 'board_deletion',
		state: 'stalled',
	});

	await expect(t.mutation(internal.operations.scanAlerts, {})).resolves.toMatchObject({
		active: 1,
		created: 0,
	});
	expect(await t.run((ctx) => ctx.db.query('operationalAlerts').collect())).toHaveLength(1);

	await t.run((ctx) => ctx.db.delete('feedbackBoards', ids.boardId));
	await expect(t.mutation(internal.operations.scanAlerts, {})).resolves.toMatchObject({
		resolved: 1,
	});
	alerts = await t.run((ctx) => ctx.db.query('operationalAlerts').collect());
	expect(alerts[0]?.resolvedAt).toBeTypeOf('number');
	await t.run(async (ctx) => {
		await ctx.db.patch('operationalAlerts', alerts[0]!._id, {
			resolvedAt: Date.now() - 91 * 24 * 60 * 60_000,
		});
	});
	await expect(t.mutation(internal.operations.cleanupHistory, {})).resolves.toEqual({
		alerts: 1,
		jobs: 1,
		maintenance: 0,
	});
	expect(await t.run((ctx) => ctx.db.get('storageCleanupJobs', ids.cleanupId))).toBeNull();
	expect(await t.run((ctx) => ctx.db.query('operationalAlerts').collect())).toEqual([]);
});

test('system admins can preview and repair aggregate drift with bounded resumable jobs', async () => {
	const t = convexTest(schema, modules);
	const ids = await t.run(async (ctx) => {
		const adminId = await ctx.db.insert('users', { status: 'active', systemRole: 'system:admin' });
		const outsiderId = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const profileId = await ctx.db.insert('profiles', {
			name: 'Admin',
			userId: adminId,
			username: 'operations-admin',
		});
		const organizationId = await ctx.db.insert('organizations', {
			name: 'Maintenance',
			slug: 'maintenance',
			visibility: 'private',
		});
		const projectId = await ctx.db.insert('projects', {
			name: 'Counters',
			organizationId,
			slug: 'counters',
			visibility: 'private',
		});
		const boardId = await ctx.db.insert('feedbackBoards', {
			name: 'Ideas',
			projectId,
			slug: 'ideas',
		});
		const feedbackId = await ctx.db.insert('feedback', {
			authorProfileId: profileId,
			boardId,
			priority: 'none',
			projectId,
			searchContent: 'Drift',
			slug: 'drift',
			status: 'open',
			tags: [],
			title: 'Drift',
			updatedAt: Date.now(),
			upvotes: 9,
		});
		await ctx.db.insert('feedbackUpvotes', { authorProfileId: profileId, feedbackId });
		const updateId = await ctx.db.insert('updates', {
			authorProfileId: profileId,
			category: 'changelog',
			commentCount: 7,
			content: 'Drift',
			heartCount: 8,
			projectId,
			relatedFeedbackIds: [],
			searchContent: 'Drift',
			slug: 'update-drift',
			status: 'draft',
			tags: [],
			title: 'Drift',
			updatedAt: Date.now(),
		});
		await ctx.db.insert('updateComments', {
			authorProfileId: profileId,
			content: 'One',
			emoteCounts: {},
			updateId,
		});
		await ctx.db.insert('updateEmotes', {
			authorProfileId: profileId,
			content: 'heart',
			updateId,
		});
		return { adminId, feedbackId, outsiderId, updateId };
	});
	const admin = t.withIdentity({ issuer, subject: ids.adminId });
	const outsider = t.withIdentity({ issuer, subject: ids.outsiderId });

	await expect(
		outsider.mutation(api.adminOperations.startMaintenance, {
			dryRun: true,
			kind: 'feedback_upvotes',
		})
	).rejects.toThrow('FORBIDDEN');

	for (const kind of ['feedback_upvotes', 'update_counts'] as const) {
		await admin.mutation(api.adminOperations.startMaintenance, { dryRun: true, kind });
		await t.finishAllScheduledFunctions(vi.runAllTimers);
	}
	const previews = await admin.query(api.adminOperations.listMaintenance, {});
	expect(previews).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ kind: 'feedback_upvotes', status: 'completed', changed: 1 }),
			expect.objectContaining({ kind: 'update_counts', status: 'completed', changed: 1 }),
		])
	);
	expect(await t.run((ctx) => ctx.db.get('feedback', ids.feedbackId))).toMatchObject({
		upvotes: 9,
	});
	expect(await t.run((ctx) => ctx.db.get('updates', ids.updateId))).toMatchObject({
		commentCount: 7,
		heartCount: 8,
	});

	for (const kind of ['feedback_upvotes', 'update_counts'] as const) {
		await admin.mutation(api.adminOperations.startMaintenance, { dryRun: false, kind });
		await t.finishAllScheduledFunctions(vi.runAllTimers);
	}
	expect(await t.run((ctx) => ctx.db.get('feedback', ids.feedbackId))).toMatchObject({
		upvotes: 1,
	});
	expect(await t.run((ctx) => ctx.db.get('updates', ids.updateId))).toMatchObject({
		commentCount: 1,
		heartCount: 1,
	});
});
