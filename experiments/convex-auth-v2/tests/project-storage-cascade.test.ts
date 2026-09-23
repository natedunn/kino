// @vitest-environment edge-runtime
import type { Id } from '../relationships/convex/_generated/dataModel';

import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { afterEach, expect, test, vi } from 'vitest';

import schema from '../relationships/convex/schema';

const modules = import.meta.glob('../relationships/convex/**/*.{ts,js}');
const mutation = (name: string) => makeFunctionReference<'mutation'>(name);

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

async function setup() {
	vi.useFakeTimers();
	const t = convexTest(schema, modules);
	const [ownerId, outsiderId] = await t.run((ctx) =>
		Promise.all([
			ctx.db.insert('users', { verified: true }),
			ctx.db.insert('users', { verified: true }),
		])
	);
	const [organizationId, otherOrganizationId] = await t.run((ctx) =>
		Promise.all([
			ctx.db.insert('organizations', { ownerId }),
			ctx.db.insert('organizations', { ownerId: outsiderId }),
		])
	);
	const [projectId, otherProjectId] = await t.run((ctx) =>
		Promise.all([
			ctx.db.insert('projects', { ownerId, organizationId, deleting: false }),
			ctx.db.insert('projects', {
				ownerId: outsiderId,
				organizationId: otherOrganizationId,
				deleting: false,
			}),
		])
	);
	return {
		t,
		owner: t.withIdentity({ subject: ownerId }),
		outsider: t.withIdentity({ subject: outsiderId }),
		projectId,
		otherProjectId,
	};
}

test('project deletion waits for 31 external cleanups, then removes storage metadata and preserves another tenant', async () => {
	const s = await setup();
	const createAsset = (projectId: Id<'projects'>, index: number, client = s.owner) =>
		client.mutation(mutation('projectStorage:createAsset'), {
			projectId,
			publicId: index.toString(16).padStart(32, '0'),
			size: 10 + index,
		});
	for (let index = 1; index <= 31; index++) await createAsset(s.projectId, index);
	const retainedAsset = await createAsset(s.otherProjectId, 99, s.outsider);
	vi.stubEnv('PROOF_STORAGE_DELETE_URL', 'https://storage.invalid/delete');
	vi.stubEnv('PROOF_STORAGE_DELETE_TOKEN', 'fixture');
	const requests: Array<{ keys: string[]; cacheTag: string }> = [];
	vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
		requests.push(JSON.parse(String(init?.body)));
		return new Response(null, { status: 204 });
	});
	const projectJobId: Id<'jobs'> = await s.owner.mutation(mutation('lifecycle:beginDelete'), {
		projectId: s.projectId,
	});
	await expect(
		s.owner.mutation(mutation('projectStorage:createAsset'), {
			projectId: s.projectId,
			publicId: 'f'.repeat(32),
			size: 1,
		})
	).rejects.toThrow('DELETING');
	await s.t.finishAllScheduledFunctions(vi.runAllTimers);
	expect(requests).toHaveLength(31);
	expect(new Set(requests.map((request) => request.cacheTag))).toHaveLength(31);
	for (const request of requests) expect(request.keys).toHaveLength(3);
	expect(await s.t.run((ctx) => ctx.db.get(s.projectId))).toBeNull();
	expect(await s.t.run((ctx) => ctx.db.get(projectJobId))).toMatchObject({ done: true });
	for (const table of [
		'fileObjects',
		'fileAssets',
		'projectStorageUsage',
		'storageCleanupJobs',
	] as const)
		expect(
			await s.t.run((ctx) =>
				ctx.db
					.query(table)
					.withIndex('by_projectId', (q) => q.eq('projectId', s.projectId))
					.collect()
			)
		).toEqual([]);
	expect(await s.t.run((ctx) => ctx.db.get(s.otherProjectId))).not.toBeNull();
	expect(await s.t.run((ctx) => ctx.db.get(retainedAsset))).not.toBeNull();
	expect(
		await s.t.run((ctx) =>
			ctx.db
				.query('projectStorageUsage')
				.withIndex('by_projectId', (q) => q.eq('projectId', s.otherProjectId))
				.unique()
		)
	).toMatchObject({ usedBytes: 109, fileCount: 1 });
});

test('persistent external failure keeps project, metadata, and quota fenced until owner resume succeeds', async () => {
	const s = await setup();
	const assetId = await s.owner.mutation(mutation('projectStorage:createAsset'), {
		projectId: s.projectId,
		publicId: 'a'.repeat(32),
		size: 50,
	});
	vi.stubEnv('PROOF_STORAGE_DELETE_URL', 'https://storage.invalid/delete');
	vi.stubEnv('PROOF_STORAGE_DELETE_TOKEN', 'fixture');
	const fetchMock = vi.fn(async () => new Response(null, { status: 503 }));
	vi.stubGlobal('fetch', fetchMock);
	const projectJobId: Id<'jobs'> = await s.owner.mutation(mutation('lifecycle:beginDelete'), {
		projectId: s.projectId,
	});
	await s.t.finishAllScheduledFunctions(vi.runAllTimers);
	expect(fetchMock).toHaveBeenCalledTimes(3);
	expect(await s.t.run((ctx) => ctx.db.get(s.projectId))).toMatchObject({ deleting: true });
	expect(await s.t.run((ctx) => ctx.db.get(assetId))).toMatchObject({ state: 'deleting' });
	expect(
		await s.t.run((ctx) =>
			ctx.db
				.query('projectStorageUsage')
				.withIndex('by_projectId', (q) => q.eq('projectId', s.projectId))
				.unique()
		)
	).toMatchObject({ usedBytes: 50, fileCount: 1 });
	expect(
		await s.t.run((ctx) =>
			ctx.db
				.query('storageCleanupJobs')
				.withIndex('by_projectId_state', (q) =>
					q.eq('projectId', s.projectId).eq('state', 'failed')
				)
				.unique()
		)
	).toMatchObject({ attempt: 3, lastError: 'RETRY_LIMIT' });
	for (const client of [s.t, s.outsider])
		await expect(
			client.mutation(mutation('lifecycle:resume'), { jobId: projectJobId })
		).rejects.toThrow('FORBIDDEN');
	fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
	await s.owner.mutation(mutation('lifecycle:resume'), { jobId: projectJobId });
	await s.t.finishAllScheduledFunctions(vi.runAllTimers);
	expect(await s.t.run((ctx) => ctx.db.get(s.projectId))).toBeNull();
	expect(await s.t.run((ctx) => ctx.db.get(projectJobId))).toMatchObject({ done: true });
});

test('project finalization refuses forged cleanup completion while storage accounting remains', async () => {
	const s = await setup();
	await s.owner.mutation(mutation('projectStorage:createAsset'), {
		projectId: s.projectId,
		publicId: 'b'.repeat(32),
		size: 20,
	});
	const projectJobId: Id<'jobs'> = await s.owner.mutation(mutation('lifecycle:beginDelete'), {
		projectId: s.projectId,
	});
	await s.t.mutation(mutation('lifecycle:step'), { jobId: projectJobId, version: 0 });
	const cleanupJob = await s.t.run((ctx) =>
		ctx.db
			.query('storageCleanupJobs')
			.withIndex('by_projectId', (q) => q.eq('projectId', s.projectId))
			.unique()
	);
	await s.t.run((ctx) => ctx.db.patch(cleanupJob!._id, { state: 'done' }));
	await expect(
		s.t.mutation(mutation('lifecycle:step'), { jobId: projectJobId, version: 1 })
	).rejects.toThrow('STORAGE_ACCOUNTING_NOT_ZERO');
	expect(await s.t.run((ctx) => ctx.db.get(s.projectId))).toMatchObject({ deleting: true });
});

test('project deletion waits through a pending upload settlement window and releases reserved quota', async () => {
	const s = await setup();
	const pending = await s.owner.mutation(mutation('projectStorage:createPendingAsset'), {
		projectId: s.projectId,
		publicId: 'c'.repeat(32),
		size: 75,
		ttlMs: 1_000,
	});
	const projectJobId: Id<'jobs'> = await s.owner.mutation(mutation('lifecycle:beginDelete'), {
		projectId: s.projectId,
	});
	await s.t.mutation(mutation('lifecycle:step'), { jobId: projectJobId, version: 0 });
	const cleanupJob = await s.t.run((ctx) =>
		ctx.db
			.query('storageCleanupJobs')
			.withIndex('by_projectId', (q) => q.eq('projectId', s.projectId))
			.unique()
	);
	expect(cleanupJob).toMatchObject({ accounting: 'reserved', notBefore: pending.settleAfter });
	expect(
		await s.t.mutation(mutation('projectStorage:claim'), { jobId: cleanupJob!._id })
	).toBeNull();
	expect(await s.t.run((ctx) => ctx.db.get(s.projectId))).not.toBeNull();
	expect(
		await s.t.run((ctx) =>
			ctx.db
				.query('projectStorageUsage')
				.withIndex('by_projectId', (q) => q.eq('projectId', s.projectId))
				.unique()
		)
	).toMatchObject({ usedBytes: 0, reservedBytes: 75, fileCount: 0 });
	vi.setSystemTime(pending.settleAfter);
	const claim = await s.t.mutation(mutation('projectStorage:claim'), { jobId: cleanupJob!._id });
	await s.t.mutation(mutation('projectStorage:ack'), {
		jobId: cleanupJob!._id,
		attempt: claim.attempt,
	});
	await s.t.finishAllScheduledFunctions(vi.runAllTimers);
	expect(await s.t.run((ctx) => ctx.db.get(s.projectId))).toBeNull();
});
