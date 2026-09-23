import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';

import { ConvexHttpClient } from 'convex/browser';
import { Miniflare } from 'miniflare';

import { deleteObjectsAndPurgeTag } from '../storage/deleteAdapter.ts';

const config = JSON.parse(
	await readFile(
		new URL('../relationships/.convex/local/default/config.json', import.meta.url),
		'utf8'
	)
);
assert.equal(config.ports.cloud, 4430);
const mf = new Miniflare({
	modules: true,
	script: 'export default {fetch(){return new Response("proof")}}',
	r2Buckets: ['ORG_UPLOADS'],
	compatibilityDate: '2026-05-28',
});
const bucket = await mf.getR2Bucket('ORG_UPLOADS');
const purgeTags = [];
const server = createServer(async (request, response) => {
	try {
		if (
			request.method !== 'POST' ||
			request.url !== '/delete' ||
			request.headers.authorization !== 'Bearer local-proof-token'
		) {
			response.writeHead(401).end();
			return;
		}
		const chunks = [];
		for await (const chunk of request) chunks.push(chunk);
		const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
		await deleteObjectsAndPurgeTag(
			{
				ORG_UPLOADS: bucket,
				CLOUDFLARE_ZONE_ID: 'local-proof-zone',
				CLOUDFLARE_API_TOKEN: 'local-proof-api-token',
			},
			body,
			async (_input, init) => {
				purgeTags.push(...JSON.parse(String(init?.body)).tags);
				return new Response('{}', { status: 200 });
			}
		);
		response.writeHead(204).end();
	} catch {
		response.writeHead(500).end();
	}
});
await new Promise((resolve) => server.listen(4432, '127.0.0.1', resolve));

try {
	const admin = new ConvexHttpClient('http://127.0.0.1:4430', { logger: false });
	admin.setAdminAuth(config.adminKey);
	const first = await admin.mutation('fixtures:seed', {});
	const second = await admin.mutation('fixtures:seed', {});
	const clientFor = (fixture) => {
		const client = new ConvexHttpClient('http://127.0.0.1:4430', { logger: false });
		client.setAdminAuth(config.adminKey, {
			subject: fixture.userId,
			issuer: 'proof-fixture',
			tokenIdentifier: `proof-fixture|${fixture.userId}`,
		});
		return client;
	};
	const owner = clientFor(first);
	const outsider = clientFor(second);
	const projectId = await owner.mutation('feedbackSlice:createProject', {
		organizationId: first.organizationId,
	});
	const otherProjectId = await outsider.mutation('feedbackSlice:createProject', {
		organizationId: second.organizationId,
	});
	for (let index = 1; index <= 4; index++)
		await owner.mutation('projectStorage:createAsset', {
			projectId,
			publicId: index.toString(16).padStart(32, '0'),
			size: index * 10,
		});
	await outsider.mutation('projectStorage:createAsset', {
		projectId: otherProjectId,
		publicId: 'f'.repeat(32),
		size: 99,
	});
	const before = await admin.query('fixtures:inspectProjectStorage', { projectId });
	const otherBefore = await admin.query('fixtures:inspectProjectStorage', {
		projectId: otherProjectId,
	});
	for (const key of [...before.objectKeys, ...otherBefore.objectKeys])
		await bucket.put(key, 'proof');
	await owner.mutation('lifecycle:beginDelete', { projectId });
	let after;
	for (let attempt = 0; attempt < 100; attempt++) {
		after = await admin.query('fixtures:inspectProjectStorage', { projectId });
		if (!after.projectExists) break;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	assert.equal(after.projectExists, false);
	for (const key of before.objectKeys) assert.equal(await bucket.head(key), null);
	for (const key of otherBefore.objectKeys) assert.notEqual(await bucket.head(key), null);
	assert.equal(new Set(purgeTags).size, 4);
	const otherAfter = await admin.query('fixtures:inspectProjectStorage', {
		projectId: otherProjectId,
	});
	assert.deepEqual(otherAfter.usage, { usedBytes: 99, reservedBytes: 0, fileCount: 1 });
	const result = {
		checkedAt: new Date().toISOString(),
		target: 'isolated local backend 4430 + local R2',
		deletedAssets: 4,
		deletedObjects: before.objectKeys.length,
		purgedTags: new Set(purgeTags).size,
		projectRemoved: true,
		otherTenantPreserved: true,
	};
	await writeFile(
		new URL('../relationships/results-project-storage-live.json', import.meta.url),
		JSON.stringify(result, null, 2) + '\n'
	);
	console.log(JSON.stringify(result, null, 2));
} finally {
	await new Promise((resolve) => server.close(resolve));
	await mf.dispose();
}
