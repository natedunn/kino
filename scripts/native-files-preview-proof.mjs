// Disposable storage acceptance only. Never accepts an arbitrary deployment.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference as ref } from 'convex/server';
import sharp from 'sharp';

const directory = new URL('../integrations/native-convex/', import.meta.url);
const key = parseEnv(
	await readFile(new URL('.env.preview.local', directory), 'utf8')
).CONVEX_DEPLOY_KEY;
assert.ok(key?.startsWith('dev:giant-jaguar-319|'));
const url = 'https://giant-jaguar-319.convex.cloud';
const admin = new ConvexHttpClient(url, { logger: false });
admin.setAdminAuth(key);
const anonymous = new ConvexHttpClient(url, { logger: false });
const stateFile = new URL('.env.storage-proof.local.json', directory);
let state;
try {
	state = JSON.parse(await readFile(stateFile, 'utf8'));
} catch (error) {
	if (error.code !== 'ENOENT') throw error;
}
async function save() {
	await writeFile(stateFile, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
}
if (!state) {
	const fixture = randomUUID();
	const userId = await admin.mutation(ref('github:createUser'), {
		provider: {
			name: 'github',
			accountId: fixture,
			profile: {
				id: fixture,
				login: 'storage-proof-' + fixture.slice(0, 8),
				name: 'Native storage proof',
				email: fixture + '@example.test',
				emailVerified: true,
			},
		},
	});
	state = { userId, phase: 'created' };
	await save();
}
// This tests deployed storage policy with a dedicated fixture identity, not OAuth.
const owner = new ConvexHttpClient(url, { logger: false });
owner.setAdminAuth(key, { subject: state.userId, issuer: 'https://giant-jaguar-319.convex.site' });
const organization = await owner.query(ref('organizations:personal'), {});
if (!state.projectId) {
	state.projectId = await owner.mutation(ref('policy:createProject'), {
		organizationId: organization.id,
		name: 'Native storage transport proof',
		slug: 'native-storage-transport-proof',
	});
	await save();
}
const projectId = state.projectId;
if (state.phase !== 'cleanup' && state.phase !== 'done') {
	await owner.mutation(ref('policy:setOrganizationVisibility'), {
		organizationId: organization.id,
		visibility: 'public',
	});
	await owner.mutation(ref('policy:updateProject'), { projectId, visibility: 'public' });
	if (!state.assetId) {
		const bytes = await sharp({
			create: { width: 256, height: 128, channels: 3, background: '#4582de' },
		})
			.png()
			.toBuffer();
		const [intent] = await owner.action(ref('filesTransport:start'), {
			projectId,
			files: [
				{ name: 'native-live-transport.png', mimeType: 'image/png', sizeBytes: bytes.length },
			],
		});
		state.assetId = intent.assetId;
		await save();
		const put = await fetch(intent.url, {
			method: 'PUT',
			headers: { 'content-type': intent.mimeType },
			body: bytes,
		});
		assert.equal(put.status, 200);
		await owner.action(ref('filesTransport:complete'), { assetId: intent.assetId });
	}
	const detail = await owner.query(ref('files:detail'), { assetId: state.assetId });
	const publicUrl = await owner.action(ref('filesTransport:download'), {
		assetId: state.assetId,
		inline: true,
	});
	assert.equal(new URL(publicUrl).origin, 'https://native-files-proof.usekino.com');
	const original = await fetch(publicUrl);
	assert.equal(original.status, 200);
	assert.equal((await original.arrayBuffer()).byteLength, detail.bytes);
	const head = await fetch(publicUrl, { method: 'HEAD' });
	assert.equal(head.status, 200);
	assert.equal(Number(head.headers.get('content-length')), detail.bytes);
	const range = await fetch(publicUrl, { headers: { Range: 'bytes=0-15' } });
	assert.equal(range.status, 206);
	assert.equal((await range.arrayBuffer()).byteLength, 16);
	const thumbUrl = await owner.action(ref('filesTransport:download'), {
		assetId: state.assetId,
		thumbnail: true,
		inline: true,
	});
	const thumb = await fetch(thumbUrl);
	assert.equal(thumb.status, 200);
	assert.equal(thumb.headers.get('content-type'), 'image/webp');
	const thumbInfo = await sharp(Buffer.from(await thumb.arrayBuffer())).metadata();
	assert.equal(thumbInfo.width, 128);
	assert.equal(thumbInfo.height, 128);
	await owner.mutation(ref('policy:updateProject'), { projectId, visibility: 'private' });
	assert.equal((await fetch(publicUrl)).status, 404, 'visibility must revoke a cached public URL');
	assert.equal(
		await anonymous.query(ref('files:publicMetadata'), { publicId: detail.asset.publicId }),
		null
	);
	await owner.mutation(ref('policy:updateProject'), { projectId, visibility: 'public' });
	const folderId = await owner.mutation(ref('files:saveFolder'), {
		projectId,
		name: 'Moved proof',
	});
	await owner.mutation(ref('files:edit'), {
		assetId: state.assetId,
		name: 'renamed-proof',
		folderId,
	});
	assert.equal(
		(await owner.query(ref('files:detail'), { assetId: state.assetId })).asset.folderId,
		folderId
	);
	await owner.mutation(ref('files:remove'), { assetId: state.assetId });
	assert.equal((await fetch(publicUrl)).status, 404, 'deletion must revoke a cached public URL');
	state.phase = 'cleanup';
	state.folderId = folderId;
	state.publicId = detail.asset.publicId;
	state.checks = [
		'upload',
		'validated completion',
		'GET',
		'HEAD',
		'range',
		'128px WebP',
		'cached visibility revocation',
		'rename/move',
		'deletion fence',
	];
	await save();
	console.log('Live storage checks passed:', state.checks.join(', '));
}
const paginationOpts = { cursor: null, numItems: 100 };
const jobs = [];
for (const status of ['pending', 'running', 'failed', 'done'])
	jobs.push(
		...(await owner.query(ref('filesJobs:list'), { projectId, state: status, paginationOpts })).page
	);
for (const job of jobs.filter((j) => j.state === 'failed'))
	await owner.mutation(ref('filesJobs:resume'), { jobId: job._id });
for (const job of jobs.filter((j) => j.state !== 'done' && j.notBefore <= Date.now()))
	await admin.action(ref('filesTransport:cleanup'), { jobId: job._id });
const usage = (await owner.query(ref('files:usage'), { projectId })).usage;
if (usage?.usedBytes === 0 && usage.reservedBytes === 0) {
	if (state.folderId) await owner.mutation(ref('files:removeFolder'), { folderId: state.folderId });
	state.phase = 'done';
	delete state.folderId;
	await save();
	console.log('Physical deletion + purge acknowledged; quota zero.');
} else
	console.log('Cleanup remains pending; retained usage:', {
		usedBytes: usage?.usedBytes,
		reservedBytes: usage?.reservedBytes,
		notBefore: jobs
			.filter((j) => j.state !== 'done')
			.map((j) => new Date(j.notBefore).toISOString()),
	});
