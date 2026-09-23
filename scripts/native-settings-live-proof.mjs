// Isolated native development fixture; admin impersonation tests app policy,
// not login. Browser acceptance uses the existing signed-in owner session.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference as ref } from 'convex/server';

const directory = 'integrations/native-convex/';
const environment = parseEnv(readFileSync(directory + '.env.preview.local', 'utf8'));
assert.ok(environment.CONVEX_DEPLOY_KEY.startsWith('dev:giant-jaguar-319|'));
const owner = JSON.parse(
	readFileSync(directory + '.env.relay-onda-proof.local.json', 'utf8')
).userId;
const client = new ConvexHttpClient('https://giant-jaguar-319.convex.cloud', { logger: false });
client.setAdminAuth(environment.CONVEX_DEPLOY_KEY, {
	subject: owner,
	issuer: 'https://giant-jaguar-319.convex.site',
});
const path = directory + '.env.settings-proof.local.json';
const state = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
const save = () => writeFileSync(path, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
if (process.argv[2] === 'setup') {
	if (!state.organizationId) {
		state.organizationId = await client.mutation(ref('organizations:create'), {
			name: 'Native settings acceptance',
			slug: 'native-settings-proof',
		});
		save();
	}
	if (!state.projectId) {
		state.projectId = await client.mutation(ref('policy:createProject'), {
			organizationId: state.organizationId,
			name: 'Settings acceptance',
			slug: 'settings-proof',
		});
		save();
	}
	console.log({
		project:
			'https://kino-native-auth-proof-c318c09d.hello-fc8.workers.dev/@native-settings-proof/settings-proof/settings/general',
		organization:
			'https://kino-native-auth-proof-c318c09d.hello-fc8.workers.dev/org/settings/general?org=native-settings-proof',
	});
} else if (process.argv[2] === 'inspect') {
	const organization = await client.query(ref('organizations:listMine'), {});
	const org = organization.find((o) => o.id === state.organizationId);
	const projects = await client.query(ref('projects:listByOrganization'), {
		organizationId: state.organizationId,
	});
	const project = projects.find((p) => p.id === state.projectId);
	const details = await client.query(ref('projects:getBySlugs'), {
		organizationSlug: org.slug,
		projectSlug: project.slug,
	});
	console.log({
		organization: { name: org.name, slug: org.slug, hasLogo: !!org.logo },
		project: details.project,
		theme: details.publishedTheme?.presetId ?? null,
	});
} else if (process.argv[2] === 'seed-members') {
	const members = await client.query(ref('organizations:listMembers'), {
		organizationId: state.organizationId,
	});
	const membership = members.members.find((m) => m.user.id === owner);
	assert.equal(membership.role, 'owner');
	await assert.rejects(
		client.mutation(ref('organizations:removeMember'), { membershipId: membership.id }),
		/OWNER_FROZEN/
	);
	await client.mutation(ref('policy:setDirectProjectMember'), {
		projectId: state.projectId,
		userId: owner,
		enabled: true,
	});
	const direct = await client.query(ref('projectMembers:listProjectMembers'), {
		projectId: state.projectId,
	});
	assert.equal(direct.members.length, 1);
	const moderators = await client.query(ref('projectMembers:getManagementState'), {
		projectId: state.projectId,
	});
	assert.deepEqual(moderators.moderators, []);
	console.log(
		'Owner protection and native member queries passed; disposable direct membership ready for browser removal. Organization ownership is unchanged.'
	);
} else if (process.argv[2] === 'seed-board-child') {
	const boards = await client.query(ref('feedbackBoards:list'), { projectId: state.projectId });
	const board = boards.find((b) => b.slug === 'browser-board');
	assert.ok(board, 'Create browser-board through the preview first');
	state.boardId = board.id;
	const item = await client.mutation(ref('feedback:create'), {
		projectId: state.projectId,
		boardId: board.id,
		title: 'Disposable board cascade proof',
		firstComment: 'Removed with the disposable board.',
	});
	state.feedbackSlug = item.slug;
	save();
	await client.mutation(ref('feedbackComments:create'), {
		feedbackId: item.feedbackId,
		content: 'Disposable reply',
	});
	await client.mutation(ref('feedback:toggleUpvote'), { feedbackId: item.feedbackId });
	console.log('Disposable board feedback, reply, and vote are ready for browser deletion.');
} else if (process.argv[2] === 'check-members-board') {
	const direct = await client.query(ref('projectMembers:listProjectMembers'), {
		projectId: state.projectId,
	});
	assert.deepEqual(direct.members, []);
	const boards = await client.query(ref('feedbackBoards:list'), { projectId: state.projectId });
	assert.ok(!boards.some((b) => b.id === state.boardId));
	assert.equal(
		await client.query(ref('feedback:getDetail'), {
			projectId: state.projectId,
			slug: state.feedbackSlug,
		}),
		null
	);
	console.log(
		'Browser member removal and board/feedback disappearance confirmed through native queries. Child-row cleanup is covered by the cascade integration tests.'
	);
} else if (process.argv[2] === 'seed-export') {
	assert.ok(state.projectId, 'Run setup first');
	assert.ok(
		!state.exportFeedbackId && !state.exportUpdateId,
		'Clean the previous export fixture first'
	);
	const marker = `Native export proof ${Date.now()}`;
	const boardId = await client.mutation(ref('feedbackBoards:create'), {
		projectId: state.projectId,
		name: 'Export proof',
		slug: `export-proof-${Date.now()}`,
		description: 'Disposable user-data export fixture.',
	});
	const feedback = await client.mutation(ref('feedback:create'), {
		projectId: state.projectId,
		boardId,
		title: marker,
		firstComment: `${marker} feedback comment`,
	});
	await client.mutation(ref('feedbackComments:create'), {
		feedbackId: feedback.feedbackId,
		content: `${marker} feedback reply`,
	});
	const update = await client.mutation(ref('updates:save'), {
		projectId: state.projectId,
		title: marker,
		content: `<p>${marker} update body</p>`,
		tags: ['export-proof'],
		category: 'announcement',
		featured: false,
		relatedFeedbackIds: [],
		publish: true,
	});
	await client.mutation(ref('updates:saveComment'), {
		updateId: update.id,
		content: `${marker} update comment`,
	});
	Object.assign(state, {
		exportMarker: marker,
		exportBoardId: boardId,
		exportFeedbackId: feedback.feedbackId,
		exportUpdateId: update.id,
	});
	save();
	const result = await client.query(ref('userDataExport:exportData'), {});
	const comments = result.sections.comments;
	assert.equal(result.format, 'kino-user-data-export');
	assert.equal(result.version, 1);
	assert.ok(comments.feedbackComments.some((row) => row.content === `${marker} feedback comment`));
	assert.ok(comments.feedbackComments.some((row) => row.content === `${marker} feedback reply`));
	assert.ok(comments.updateComments.some((row) => row.content === `${marker} update comment`));
	console.log({
		accountData: 'https://kino-native-auth-proof-c318c09d.hello-fc8.workers.dev/account/data',
		marker,
	});
} else if (process.argv[2] === 'check-export') {
	assert.ok(state.exportMarker, 'Seed the export fixture first');
	const sections = await client.query(ref('userDataExport:getAvailableSections'), {});
	const result = await client.query(ref('userDataExport:exportData'), {});
	const comments = result.sections.comments;
	assert.deepEqual(
		sections.map((section) => section.id),
		['comments']
	);
	assert.ok(comments.feedbackComments.some((row) => row.content.includes(state.exportMarker)));
	assert.ok(comments.updateComments.some((row) => row.content.includes(state.exportMarker)));
	console.log({
		format: result.format,
		version: result.version,
		sectionIds: sections.map((section) => section.id),
		feedbackMatches: comments.feedbackComments.filter((row) =>
			row.content.includes(state.exportMarker)
		).length,
		updateMatches: comments.updateComments.filter((row) => row.content.includes(state.exportMarker))
			.length,
	});
} else if (process.argv[2] === 'cleanup-export') {
	if (state.exportFeedbackId) {
		await client.mutation(ref('feedback:remove'), { feedbackId: state.exportFeedbackId });
	}
	if (state.exportUpdateId) {
		await client.mutation(ref('updates:remove'), {
			projectId: state.projectId,
			ids: [state.exportUpdateId],
		});
	}
	if (state.exportBoardId) {
		await client.mutation(ref('feedbackBoards:remove'), {
			projectId: state.projectId,
			boardId: state.exportBoardId,
		});
	}
	for (let attempt = 0; attempt < 40; attempt += 1) {
		const result = await client.query(ref('userDataExport:exportData'), {});
		const comments = result.sections.comments;
		const retained = [
			...comments.feedbackComments.map((row) => row.content),
			...comments.updateComments.map((row) => row.content),
		].some((content) => content.includes(state.exportMarker));
		if (!retained) break;
		await new Promise((resolve) => setTimeout(resolve, 250));
		if (attempt === 39) throw Error('Export fixture comments were not cleaned up');
	}
	delete state.exportMarker;
	delete state.exportBoardId;
	delete state.exportFeedbackId;
	delete state.exportUpdateId;
	save();
	console.log('Disposable export fixture removed.');
} else if (process.argv[2] === 'cleanup-visual') {
	if (state.visualFileId) {
		await client.mutation(ref('files:remove'), { assetId: state.visualFileId });
		delete state.visualFileId;
		save();
	}
	if (state.visualFolderId) {
		try {
			await client.mutation(ref('files:removeFolder'), { folderId: state.visualFolderId });
			delete state.visualFolderId;
			save();
			console.log('Disposable visual-comparison folder removed.');
		} catch (error) {
			if (error.data !== 'FOLDER_NOT_EMPTY') throw error;
			console.log('Folder cleanup is waiting for the scheduled storage deletion. Retry later.');
		}
	}
} else
	throw Error(
		'Use setup, inspect, seed-members, seed-board-child, check-members-board, seed-export, check-export, cleanup-export, or cleanup-visual'
	);
