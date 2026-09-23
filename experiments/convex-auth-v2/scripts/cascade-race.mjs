import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

import { ConvexHttpClient } from 'convex/browser';

const config = JSON.parse(
	await readFile(
		new URL('../relationships/.convex/local/default/config.json', import.meta.url),
		'utf8'
	)
);
assert.equal(config.ports.cloud, 4430);
const admin = new ConvexHttpClient('http://127.0.0.1:4430', { logger: false });
admin.setAdminAuth(config.adminKey);
const fixture = await admin.mutation('fixtures:seed', {});
function client() {
	const c = new ConvexHttpClient('http://127.0.0.1:4430', { logger: false });
	c.setAdminAuth(config.adminKey, {
		subject: fixture.userId,
		issuer: 'proof-fixture',
		tokenIdentifier: `proof-fixture|${fixture.userId}`,
	});
	return c;
}
const owner = client();
const projectId = await owner.mutation('feedbackSlice:createProject', {
	organizationId: fixture.organizationId,
});
const [board, sibling] = await owner.query('lifecycle:read', { projectId });
const { feedbackId } = await owner.mutation('feedbackSlice:create', {
	boardId: board._id,
	title: 'Race',
	content: 'Fixture',
});
const retained = await owner.mutation('feedbackSlice:create', {
	boardId: sibling._id,
	title: 'Keep',
	content: 'Sibling',
});
await Promise.all(
	Array.from({ length: 60 }, () =>
		client().mutation('feedbackSlice:event', { feedbackId, kind: 'status' })
	)
);
const writes = Array.from({ length: 15 }, () =>
	client().mutation('feedbackSlice:event', { feedbackId, kind: 'assignment' })
);
const deletion = client().mutation('branchDeletion:begin', { kind: 'board', rootId: board._id });
writes.push(
	...Array.from({ length: 15 }, () =>
		client().mutation('feedbackSlice:event', { feedbackId, kind: 'assignment' })
	)
);
const outcomes = await Promise.allSettled(writes);
const jobId = await deletion;
await assert.rejects(client().mutation('feedbackSlice:event', { feedbackId, kind: 'status' }));
assert(!(await owner.query('lifecycle:read', { projectId })).some((b) => b._id === board._id));
let result;
for (let attempt = 0; attempt < 100; attempt++) {
	result = await admin.query('fixtures:inspect', { jobId, boardId: board._id });
	if (result.done) break;
	await new Promise((resolve) => setTimeout(resolve, 100));
}
assert(result.done);
assert.equal(result.boardExists, false);
assert.deepEqual(result.remaining, []);
assert.equal(
	(await owner.query('feedbackSlice:read', { feedbackId: retained.feedbackId })).title,
	'Keep'
);
const evidence = {
	checkedAt: new Date().toISOString(),
	target: 'isolated local backend 4430',
	concurrentWrites: 30,
	committed: outcomes.filter((r) => r.status === 'fulfilled').length,
	rejected: outcomes.filter((r) => r.status === 'rejected').length,
	postFenceWriteRejected: true,
	deletingBoardHidden: true,
	siblingPreserved: true,
	...result,
};
await writeFile(
	new URL('../relationships/results-race.json', import.meta.url),
	JSON.stringify(evidence, null, 2) + '\n'
);
console.log(JSON.stringify(evidence, null, 2));
