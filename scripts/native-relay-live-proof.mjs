// Isolated dev acceptance. Explicitly creates one test issue in the authorized natedunn/onda repository.
import assert from 'node:assert/strict';
import { createPrivateKey, sign } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference as ref } from 'convex/server';

const directory = 'integrations/native-convex/';
const env = parseEnv(readFileSync(directory + '.env.preview.local', 'utf8'));
assert.ok(env.CONVEX_DEPLOY_KEY?.startsWith('dev:giant-jaguar-319|'));
const stateFile = directory + '.env.relay-onda-proof.local.json';
const phase = process.argv[2];
let state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : null;
const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
const client = new ConvexHttpClient('https://giant-jaguar-319.convex.cloud', { logger: false });
if (!state) {
	assert.equal(phase, 'prepare');
	const connections = JSON.parse(readFileSync('/tmp/relay-connections-proof.json', 'utf8'));
	const c = connections.find(
		(c) =>
			c.repoFullName === 'natedunn/dos' &&
			c.projectSlug === 'native-feedback-proof' &&
			c.deletedTime === undefined
	);
	assert.ok(c);
	const profiles = JSON.parse(readFileSync('/tmp/relay-profiles-proof.json', 'utf8'));
	const p = profiles.find((p) => p._id === c.connectedByProfileId);
	assert.ok(p);
	state = {
		userId: p.userId,
		projectId: c.projectId,
		orgSlug: c.orgSlug,
		projectSlug: c.projectSlug,
		repoId: c.repoId,
		originalRepoId: c.repoId,
		originalMode: c.mode,
		enabledSources: c.enabledSources,
		feedback: [],
	};
	save();
}
// Exercise deployed policy as the already-authorized fixture owner; this does not test login.
client.setAdminAuth(env.CONVEX_DEPLOY_KEY, {
	subject: state.userId,
	issuer: 'https://giant-jaguar-319.convex.site',
});
const slugs = { orgSlug: state.orgSlug, projectSlug: state.projectSlug };
async function connection() {
	const d = await client.query(ref('relay:integration'), slugs);
	const c = d.connections.find(
		(c) => c.repoId === state.repoId || c.repoId === state.originalRepoId
	);
	assert.ok(c);
	const i = d.installations.find((i) => i.id === c.githubInstallationId);
	assert.ok(i);
	return { c, i };
}
async function github(path, method = 'GET', body) {
	const e = parseEnv(readFileSync('workers/gateway/secrets.dev.local', 'utf8'));
	assert.equal(e.GITHUB_RELAY_SLUG, 'kino-relay-dev');
	const keyPath = [
		e.GITHUB_RELAY_PRIVATE_KEY_PATH,
		resolve('workers/gateway', e.GITHUB_RELAY_PRIVATE_KEY_PATH),
	].find((p) => existsSync(p));
	const now = Math.floor(Date.now() / 1000),
		enc = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
	const input =
		enc({ alg: 'RS256', typ: 'JWT' }) +
		'.' +
		enc({ iat: now - 60, exp: now + 540, iss: e.GITHUB_RELAY_APP_ID });
	const jwt =
		input +
		'.' +
		sign('RSA-SHA256', Buffer.from(input), createPrivateKey(readFileSync(keyPath))).toString(
			'base64url'
		);
	const { i } = await connection();
	const response = await fetch(
		`https://api.github.com/app/installations/${i.installationId}/access_tokens`,
		{
			method: 'POST',
			headers: {
				authorization: 'Bearer ' + jwt,
				accept: 'application/vnd.github+json',
				'content-type': 'application/json',
				'user-agent': 'kino-native-relay-proof',
			},
			body: JSON.stringify({
				repository_ids: [state.repoId],
				permissions: { issues: 'write', metadata: 'read' },
			}),
		}
	);
	assert.equal(response.status, 201);
	const { token } = await response.json();
	const r = await fetch('https://api.github.com/repos/natedunn/onda' + path, {
		method,
		headers: {
			authorization: 'Bearer ' + token,
			accept: 'application/vnd.github+json',
			'content-type': 'application/json',
			'user-agent': 'kino-native-relay-proof',
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	});
	assert.ok(r.ok, `GitHub status ${r.status}`);
	return r.json();
}
if (phase === 'prepare') {
	assert.ok(
		!state.cleaned,
		'This one-off acceptance run is already cleaned; do not recreate external content'
	);
	const { i } = await connection();
	const repositories = await client.action(
		ref('relayActions:listInstallationRepositoriesForProject'),
		{ orgSlug: state.orgSlug, installationId: i.installationId }
	);
	const target = repositories.find((r) => r.fullName === 'natedunn/onda');
	assert.ok(target);
	state.repoId = target.id;
	save();
	const metadata = await github('');
	assert.equal(metadata.archived, false, 'Test repo must not be archived');
	await client.action(ref('relayActions:connectRepository'), {
		...slugs,
		installationId: i.installationId,
		repoId: state.repoId,
		mode: 'read_write',
		enabledSources: state.enabledSources,
	});
	const boards = await client.query(ref('feedbackBoards:list'), { projectId: state.projectId });
	assert.ok(boards?.length);
	while (state.feedback.length < 2) {
		const f = await client.mutation(ref('feedback:create'), {
			projectId: state.projectId,
			boardId: boards[0].id,
			title: `Native Relay disposable proof ${state.feedback.length + 1}`,
			firstComment: 'Temporary migration acceptance fixture; removed after verification.',
		});
		state.feedback.push(f);
		save();
	}
	const feedbackUrl = (f) =>
		`https://kino-native-auth-proof-c318c09d.hello-fc8.workers.dev/@${state.orgSlug}/${state.projectSlug}/feedback/${f.slug}`;
	if (!state.issue) {
		const f = state.feedback[0];
		await client.action(ref('relayFeedbackActions:connect'), {
			feedbackId: f.feedbackId,
			kind: 'issue',
			feedbackUrl: feedbackUrl(f),
			title: '[Kino native proof] Disposable Relay acceptance',
			body: 'Automated migration acceptance test authorized by the repository owner. This issue will be closed after webhook verification. No product work is requested.',
		});
		const links = await client.query(ref('relayFeedback:listByFeedback'), {
			feedbackId: f.feedbackId,
		});
		assert.equal(links.length, 1);
		state.issue = { number: links[0].githubNumber, url: links[0].url };
		save();
	}
	const f = state.feedback[1];
	let links = await client.query(ref('relayFeedback:listByFeedback'), { feedbackId: f.feedbackId });
	if (!links.length)
		await client.action(ref('relayFeedbackActions:connect'), {
			feedbackId: f.feedbackId,
			kind: 'issue',
			feedbackUrl: feedbackUrl(f),
			githubNumber: state.issue.number,
		});
	const before = await github(`/issues/${state.issue.number}/comments`);
	await assert.rejects(
		client.action(ref('relayFeedbackActions:connect'), {
			feedbackId: f.feedbackId,
			kind: 'issue',
			feedbackUrl: feedbackUrl(f),
			githubNumber: state.issue.number,
		})
	);
	const after = await github(`/issues/${state.issue.number}/comments`);
	assert.equal(after.length, before.length, 'duplicate must not post a second backlink');
	console.log({
		phase: 'linked',
		issue: state.issue.url,
		feedbackUrls: state.feedback.map(feedbackUrl),
		duplicateRejected: true,
	});
} else if (phase === 'close') {
	assert.ok(state.issue);
	const issue = await github(`/issues/${state.issue.number}`, 'PATCH', {
		state: 'closed',
		state_reason: 'completed',
		title: '[Kino native proof] Relay acceptance completed',
	});
	assert.equal(issue.state, 'closed');
	state.closed = true;
	save();
	console.log({ phase: 'closed', issue: state.issue.url });
} else if (phase === 'check') {
	for (const f of state.feedback) {
		const links = await client.query(ref('relayFeedback:listByFeedback'), {
			feedbackId: f.feedbackId,
		});
		assert.equal(links.length, 1);
		assert.equal(links[0].state, 'closed');
		assert.equal(links[0].title, '[Kino native proof] Relay acceptance completed');
	}
	console.log({ phase: 'webhook snapshots confirmed', feedbackCount: state.feedback.length });
} else if (phase === 'cleanup') {
	assert.ok(state.closed || !state.issue, 'Close test issue before cleanup');
	for (const f of state.feedback)
		await client.mutation(ref('feedback:remove'), { feedbackId: f.feedbackId });
	const { i } = await connection();
	await client.action(ref('relayActions:connectRepository'), {
		...slugs,
		installationId: i.installationId,
		repoId: state.originalRepoId,
		mode: state.originalMode,
		enabledSources: state.enabledSources,
	});
	state.cleaned = true;
	save();
	console.log({
		phase: 'cleanup requested',
		restoredMode: state.originalMode,
		closedIssue: state.issue?.url,
	});
} else if (phase === 'verify-cleanup') {
	assert.ok(state.cleaned);
	const { c } = await connection();
	assert.equal(c.repoId, state.originalRepoId);
	assert.equal(c.mode, state.originalMode);
	for (const f of state.feedback)
		assert.equal(
			await client.query(ref('feedback:getDetail'), { projectId: state.projectId, slug: f.slug }),
			null
		);
	console.log({
		phase: 'cleanup verified',
		repository: c.repoFullName,
		mode: c.mode,
		removedFeedback: state.feedback.length,
	});
} else throw Error('Use prepare, close, check, cleanup, or verify-cleanup');
