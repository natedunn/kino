// @vitest-environment node
import type { Id } from '../storage/convex/_generated/dataModel';

import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { expect, test, vi } from 'vitest';

import schema from '../storage/convex/schema';
import { deleteObjectsAndPurgeTag } from '../storage/deleteAdapter';

const modules = import.meta.glob('../storage/convex/**/*.{ts,js}');
const m = (name: string) => makeFunctionReference<'mutation'>(`files:${name}`);
const action = makeFunctionReference<'action'>('files:run');

test.sequential(
	'real local R2: lost acknowledgement retries an absent object and preserves replacement and other tenant',
	async () => {
		const mf = new Miniflare({
			modules: true,
			script: 'export default {fetch(){return new Response("proof")}}',
			r2Buckets: ['ORG_UPLOADS'],
			compatibilityDate: '2026-05-28',
		});
		const originalFetch = globalThis.fetch;
		try {
			const bucket = await mf.getR2Bucket('ORG_UPLOADS');
			const t = convexTest(schema, modules);
			const tenantId = await t.run((ctx) =>
				ctx.db.insert('tenants', { owner: 'owner', used: 0, reserved: 0, count: 0 })
			);
			const otherId = await t.run((ctx) =>
				ctx.db.insert('tenants', { owner: 'other', used: 0, reserved: 0, count: 0 })
			);
			const register = (id: typeof tenantId) =>
				t.mutation(m('register'), { tenantId: id, name: 'same.txt', bytes: 3, pending: false });
			const old = await register(tenantId),
				replacement = await register(tenantId),
				other = await register(otherId);
			for (const asset of [old, replacement, other]) await bucket.put(asset.key, 'abc');
			const jobId = await t
				.withIdentity({ subject: 'owner' })
				.mutation(m('remove'), { assetId: old.id });
			vi.stubEnv('PROOF_STORAGE_DELETE_URL', 'https://proof.invalid/delete');
			vi.stubEnv('PROOF_STORAGE_DELETE_TOKEN', 'fixture');
			let deletes = 0;
			vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
				if (String(input) !== 'https://proof.invalid/delete') return originalFetch(input, init);
				const { keys } = JSON.parse(String(init?.body));
				await bucket.delete(keys);
				deletes++;
				// Inject acknowledgement failure AFTER R2 deletion, without changing the job.
				if (deletes === 1) await t.run((ctx) => ctx.db.patch(tenantId, { used: 0 }));
				return new Response(null, { status: 204 });
			});
			await t.action(action, { jobId });
			expect(await bucket.head(old.key)).toBeNull();
			expect(await t.run((ctx) => ctx.db.get(jobId))).toMatchObject({
				state: 'running',
				lastError: 'DELETE_OR_ACK_FAILED',
			});
			await t.run(async (ctx) => {
				await ctx.db.patch(tenantId, { used: 6 });
				await ctx.db.patch(jobId, { leaseUntil: 0 });
			});
			await t.action(action, { jobId });
			await t.action(action, { jobId });
			expect(deletes).toBe(2);
			expect(await t.run((ctx) => ctx.db.get(tenantId))).toMatchObject({ used: 3, count: 1 });
			expect(await t.run((ctx) => ctx.db.get(otherId))).toMatchObject({ used: 3, count: 1 });
			expect(await bucket.head(replacement.key)).not.toBeNull();
			expect(await bucket.head(other.key)).not.toBeNull();
		} finally {
			vi.unstubAllGlobals();
			vi.unstubAllEnvs();
			await mf.dispose();
		}
	},
	20_000
);

test.sequential(
	'late staged upload is removed after its revoked grant settles, with one global cache tag purge',
	async () => {
		const mf = new Miniflare({
			modules: true,
			script: 'export default {fetch(){return new Response("proof")}}',
			r2Buckets: ['ORG_UPLOADS'],
			compatibilityDate: '2026-05-28',
		});
		try {
			const bucket = await mf.getR2Bucket('ORG_UPLOADS');
			const t = convexTest(schema, modules);
			const tenantId = await t.run((ctx) =>
				ctx.db.insert('tenants', { owner: 'owner', used: 0, reserved: 0, count: 0 })
			);
			const owner = t.withIdentity({ subject: 'owner' });
			const upload = await owner.mutation(m('beginUpload'), {
				tenantId,
				name: 'late.png',
				bytes: 4,
				ttlMs: 1_000,
			});
			const jobId: Id<'cleanup'> = await owner.mutation(m('remove'), {
				assetId: upload.assetId,
			});
			// This represents a request that held a still-valid upload grant when deletion began.
			await bucket.put(upload.stagingKey, 'late');
			await bucket.put(upload.key, 'partial-promotion');
			const job = await t.run((ctx) => ctx.db.get(jobId));
			const purgeCalls: Array<{ input: string; init?: RequestInit }> = [];
			const purgeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
				purgeCalls.push({ input: String(input), init });
				return new Response('{}', { status: purgeCalls.length === 1 ? 503 : 200 });
			};
			const env = {
				ORG_UPLOADS: bucket,
				CLOUDFLARE_ZONE_ID: 'zone-proof',
				CLOUDFLARE_API_TOKEN: 'token-proof',
			};
			await expect(
				deleteObjectsAndPurgeTag(env, { keys: job!.keys, cacheTag: job!.cacheTag }, purgeFetch)
			).rejects.toThrow('CACHE_PURGE_FAILED');
			expect(await bucket.head(upload.stagingKey)).toBeNull();
			expect(await bucket.head(upload.key)).toBeNull();
			await deleteObjectsAndPurgeTag(env, { keys: job!.keys, cacheTag: job!.cacheTag }, purgeFetch);
			expect(purgeCalls).toHaveLength(2);
			expect(JSON.parse(String(purgeCalls[1].init?.body))).toEqual({
				tags: [`kino-file-${upload.publicId}`],
			});
		} finally {
			await mf.dispose();
		}
	},
	20_000
);

test.sequential(
	'current product Worker retains a warmed public response after origin deletion; cold URL returns 404',
	async () => {
		const bundled = await build({
			entryPoints: [new URL('../../../workers/files/src/index.ts', import.meta.url).pathname],
			bundle: true,
			write: false,
			format: 'esm',
			platform: 'browser',
		});
		const mf = new Miniflare({
			modules: true,
			script: bundled.outputFiles[0].text,
			r2Buckets: ['ORG_UPLOADS'],
			compatibilityDate: '2026-05-28',
		});
		try {
			const bucket = await mf.getR2Bucket('ORG_UPLOADS');
			const id = 'a'.repeat(32),
				key = `PUBLIC_FILE.${id}`;
			await bucket.put(key, 'fixture', { httpMetadata: { contentType: 'text/plain' } });
			const url = `http://localhost/${id}/proof.txt`;
			const warm = await mf.dispatchFetch(url);
			expect(warm.status).toBe(200);
			expect(await warm.text()).toBe('fixture');
			// Cache.put is dispatched with waitUntil; wait for its local completion.
			const cache = await mf.getCaches();
			for (let i = 0; i < 50 && !(await cache.default.match(url)); i++)
				await new Promise((r) => setTimeout(r, 10));
			expect(await cache.default.match(url)).toBeDefined();
			await bucket.delete(key);
			expect(await bucket.head(key)).toBeNull();
			const cached = await mf.dispatchFetch(url);
			expect(cached.status).toBe(200);
			expect(await cached.text()).toBe('fixture');
			expect((await mf.dispatchFetch(url + '?cold=1')).status).toBe(404);
			expect((await mf.dispatchFetch(url, { method: 'HEAD' })).status).toBe(404);
		} finally {
			await mf.dispose();
		}
	},
	20_000
);
