// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { afterEach, expect, test, vi } from 'vitest';

import schema from '../storage/convex/schema';

const modules = import.meta.glob('../storage/convex/**/*.{ts,js}');
const m = (name: string) => makeFunctionReference<'mutation'>(`files:${name}`);
const q = makeFunctionReference<'query'>('files:read');
const action = makeFunctionReference<'action'>('files:run');
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});
async function setup(pending = false) {
	vi.useFakeTimers();
	const t = convexTest(schema, modules);
	const tenantId = await t.run((ctx) =>
		ctx.db.insert('tenants', { owner: 'owner', used: 0, reserved: 0, count: 0 })
	);
	const asset = await t.mutation(m('register'), {
		tenantId,
		name: 'same.png',
		bytes: 100,
		pending,
	});
	const owner = t.withIdentity({ subject: 'owner' }),
		other = t.withIdentity({ subject: 'other' });
	const quota = () => t.run((ctx) => ctx.db.get(tenantId));
	return { t, owner, other, tenantId, asset, quota };
}
test('deletion fences reads and attaches; duplicate requests and acknowledgements release quota once', async () => {
	const s = await setup();
	const args = { assetId: s.asset.id };
	for (const actor of [s.t, s.other])
		await expect(actor.mutation(m('remove'), args)).rejects.toThrow('FORBIDDEN');
	const jobId = await s.owner.mutation(m('remove'), args);
	expect(await s.owner.mutation(m('remove'), args)).toBe(jobId);
	expect(await s.owner.query(q, args)).toBeNull();
	await expect(s.owner.mutation(m('attach'), args)).rejects.toThrow('UNAVAILABLE');
	expect((await s.quota())?.used).toBe(100);
	const claim = await s.t.mutation(m('claim'), { jobId });
	expect(await s.t.mutation(m('claim'), { jobId })).toBeNull();
	await s.t.mutation(m('ack'), { jobId, attempt: claim.attempt });
	await s.t.mutation(m('ack'), { jobId, attempt: claim.attempt });
	expect(await s.quota()).toMatchObject({ used: 0, count: 0, reserved: 0 });
});
test('referenced files are restricted without hiding or releasing quota', async () => {
	const s = await setup();
	await s.owner.mutation(m('attach'), { assetId: s.asset.id });
	await expect(s.owner.mutation(m('remove'), { assetId: s.asset.id })).rejects.toThrow(
		'FILE_IN_USE'
	);
	expect(await s.owner.query(q, { assetId: s.asset.id })).not.toBeNull();
	expect((await s.quota())?.used).toBe(100);
});
test('expired leases fence old acknowledgements; capped retries can be resumed only by owner', async () => {
	const s = await setup();
	const jobId = await s.owner.mutation(m('remove'), { assetId: s.asset.id });
	for (let i = 1; i <= 3; i++) {
		expect((await s.t.mutation(m('claim'), { jobId })).attempt).toBe(i);
		vi.setSystemTime(Date.now() + 30_001);
	}
	expect(await s.t.mutation(m('claim'), { jobId })).toBeNull();
	await expect(s.other.mutation(m('resume'), { jobId })).rejects.toThrow('FORBIDDEN');
	await s.owner.mutation(m('resume'), { jobId });
	const claim = await s.t.mutation(m('claim'), { jobId });
	expect(claim.attempt).toBe(4);
	await s.t.mutation(m('ack'), { jobId, attempt: 3 });
	expect((await s.quota())?.used).toBe(100);
	await s.t.mutation(m('ack'), { jobId, attempt: 4 });
	expect((await s.quota())?.used).toBe(0);
});
test('pending uploads release reserved bytes and never decrement used bytes or file count', async () => {
	const s = await setup(true);
	const jobId = await s.owner.mutation(m('remove'), { assetId: s.asset.id });
	const claim = await s.t.mutation(m('claim'), { jobId });
	await s.t.mutation(m('ack'), { jobId, attempt: claim.attempt });
	expect(await s.quota()).toMatchObject({ used: 0, reserved: 0, count: 0 });
});
test('quota acknowledgement rolls back atomically; replacing a filename cannot reuse the old key', async () => {
	const s = await setup();
	const replacement = await s.t.mutation(m('register'), {
		tenantId: s.tenantId,
		name: 'same.png',
		bytes: 200,
		pending: false,
	});
	expect(replacement.key).not.toBe(s.asset.key);
	const jobId = await s.owner.mutation(m('remove'), { assetId: s.asset.id });
	const claim = await s.t.mutation(m('claim'), { jobId });
	await expect(
		s.t.run(async (ctx) => {
			await ctx.runMutation(m('ack'), { jobId, attempt: claim.attempt });
			throw new Error('crash');
		})
	).rejects.toThrow('crash');
	expect((await s.quota())?.used).toBe(300);
	await s.t.mutation(m('ack'), { jobId, attempt: claim.attempt });
	expect(await s.quota()).toMatchObject({ used: 200, count: 1 });
	expect(await s.owner.query(q, { assetId: replacement.id })).not.toBeNull();
});
test('action failures preserve accounting; successful retry deletes only stored immutable key', async () => {
	const s = await setup();
	const jobId = await s.owner.mutation(m('remove'), { assetId: s.asset.id });
	vi.stubEnv('PROOF_STORAGE_DELETE_URL', 'https://storage.invalid/delete');
	vi.stubEnv('PROOF_STORAGE_DELETE_TOKEN', 'fixture');
	const fetchMock = vi
		.fn()
		.mockResolvedValueOnce(new Response(null, { status: 503 }))
		.mockResolvedValue(new Response(null, { status: 204 }));
	vi.stubGlobal('fetch', fetchMock);
	await s.t.action(action, { jobId });
	expect((await s.quota())?.used).toBe(100);
	vi.setSystemTime(Date.now() + 30_001);
	await s.t.action(action, { jobId });
	expect((await s.quota())?.used).toBe(0);
	expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
		keys: [s.asset.key, `${s.asset.key}.thumbnail`, `${s.asset.key}.public`],
		cacheTag: `kino-file-${s.asset.publicId}`,
	});
});

test('scheduled watchdog retries failure automatically and caps persistent failures', async () => {
	const s = await setup();
	vi.stubEnv('PROOF_STORAGE_DELETE_URL', 'https://storage.invalid/delete');
	vi.stubEnv('PROOF_STORAGE_DELETE_TOKEN', 'fixture');
	const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
	vi.stubGlobal('fetch', fetchMock);
	const jobId = await s.owner.mutation(m('remove'), { assetId: s.asset.id });
	await s.t.finishAllScheduledFunctions(vi.runAllTimers);
	expect(fetchMock).toHaveBeenCalledTimes(3);
	expect(await s.t.run((ctx) => ctx.db.get(jobId))).toMatchObject({ state: 'failed', attempt: 3 });
	expect((await s.quota())?.used).toBe(100);
	fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
	await s.owner.mutation(m('resume'), { jobId });
	await s.t.finishAllScheduledFunctions(vi.runAllTimers);
	expect(await s.t.run((ctx) => ctx.db.get(jobId))).toMatchObject({ state: 'done', attempt: 4 });
	expect((await s.quota())?.used).toBe(0);
});

test('delete-before-complete revokes the upload and waits beyond grant expiry before cleanup', async () => {
	vi.useFakeTimers();
	const t = convexTest(schema, modules);
	const tenantId = await t.run((ctx) =>
		ctx.db.insert('tenants', { owner: 'owner', used: 0, reserved: 0, count: 0 })
	);
	const owner = t.withIdentity({ subject: 'owner' });
	const upload = await owner.mutation(m('beginUpload'), {
		tenantId,
		name: 'racing.png',
		bytes: 100,
		ttlMs: 1_000,
	});
	const jobId = await owner.mutation(m('remove'), { assetId: upload.assetId });
	expect(await t.mutation(m('claim'), { jobId })).toBeNull();
	await expect(
		t.mutation(m('commitUpload'), { grantId: upload.grantId, actualBytes: 100 })
	).rejects.toThrow('UPLOAD_CLOSED');
	expect(await t.run((ctx) => ctx.db.get(upload.grantId))).toMatchObject({ state: 'revoked' });
	expect(await t.run((ctx) => ctx.db.get(tenantId))).toMatchObject({
		used: 0,
		reserved: 100,
		count: 0,
	});
	vi.setSystemTime(upload.expiresAt + 29_999);
	expect(await t.mutation(m('claim'), { jobId })).toBeNull();
	vi.setSystemTime(upload.expiresAt + 30_000);
	const claim = await t.mutation(m('claim'), { jobId });
	expect(claim.keys).toContain(upload.stagingKey);
	await t.mutation(m('ack'), { jobId, attempt: claim.attempt });
	expect(await t.run((ctx) => ctx.db.get(tenantId))).toMatchObject({
		used: 0,
		reserved: 0,
		count: 0,
	});
});

test('complete-before-delete transfers reservation once, then deletion releases used quota', async () => {
	vi.useFakeTimers();
	const t = convexTest(schema, modules);
	const tenantId = await t.run((ctx) =>
		ctx.db.insert('tenants', { owner: 'owner', used: 0, reserved: 0, count: 0 })
	);
	const owner = t.withIdentity({ subject: 'owner' }),
		other = t.withIdentity({ subject: 'other' });
	for (const actor of [t, other])
		await expect(
			actor.mutation(m('beginUpload'), { tenantId, name: 'nope.png', bytes: 1, ttlMs: 1_000 })
		).rejects.toThrow('FORBIDDEN');
	const upload = await owner.mutation(m('beginUpload'), {
		tenantId,
		name: 'racing.png',
		bytes: 100,
		ttlMs: 1_000,
	});
	await expect(
		t.mutation(m('commitUpload'), { grantId: upload.grantId, actualBytes: 99 })
	).rejects.toThrow('INVALID_SIZE');
	await t.mutation(m('commitUpload'), { grantId: upload.grantId, actualBytes: 100 });
	await expect(
		t.mutation(m('commitUpload'), { grantId: upload.grantId, actualBytes: 100 })
	).rejects.toThrow('UPLOAD_CLOSED');
	expect(await t.run((ctx) => ctx.db.get(tenantId))).toMatchObject({
		used: 100,
		reserved: 0,
		count: 1,
	});
	const jobId = await owner.mutation(m('remove'), { assetId: upload.assetId });
	const claim = await t.mutation(m('claim'), { jobId });
	expect(claim).not.toBeNull();
	await t.mutation(m('ack'), { jobId, attempt: claim.attempt });
	expect(await t.run((ctx) => ctx.db.get(tenantId))).toMatchObject({
		used: 0,
		reserved: 0,
		count: 0,
	});
});
