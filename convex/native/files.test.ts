// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { DEFAULT_PROJECT_THEME } from '../shared/project-theme';
import { configureTestAuth, issuer } from '../testing/setup.testing';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.testing.ts']);
beforeEach(async () => {
	await configureTestAuth();
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});
async function fixture() {
	const t = convexTest(schema, modules);
	registerRateLimiter(t, 'authLimits');
	const ids = await t.run(async (ctx) => {
		const owner = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const reader = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const ownerProfile = await ctx.db.insert('profiles', {
			userId: owner,
			name: 'Owner',
			username: 'owner',
		});
		const readerProfile = await ctx.db.insert('profiles', {
			userId: reader,
			name: 'Reader',
			username: 'reader',
		});
		await ctx.db.patch('users', owner, { profileId: ownerProfile });
		await ctx.db.patch('users', reader, { profileId: readerProfile });
		const organizationId = await ctx.db.insert('organizations', {
			name: 'Org',
			slug: 'org',
			visibility: 'public',
		});
		await ctx.db.insert('memberships', { organizationId, userId: owner, role: 'owner' });
		const projectId = await ctx.db.insert('projects', {
			organizationId,
			name: 'Project',
			slug: 'project',
			visibility: 'public',
			updatesFeaturedMode: 'manual',
		});
		return { owner, reader, ownerProfile, readerProfile, projectId, organizationId };
	});
	const owner = t.withIdentity({ subject: ids.owner, issuer });
	const reader = t.withIdentity({ subject: ids.reader, issuer });
	const fields = {
		projectId: ids.projectId,
		title: 'Update',
		content: '<p>Searchable release</p>',
		tags: ['release'],
		category: 'changelog' as const,
		featured: false,
		relatedFeedbackIds: [],
	};
	return { t, ids, owner, reader, fields };
}
const page = { numItems: 20, cursor: null };

test('project deletion fences all writes, cascades descendants, and waits for failed storage cleanup', async () => {
	const s = await fixture();
	await s.owner.mutation(api.projectAppearance.publish, {
		light: DEFAULT_PROJECT_THEME.light,
		dark: DEFAULT_PROJECT_THEME.dark,
		presetId: DEFAULT_PROJECT_THEME.presetId,
		projectId: s.ids.projectId,
		expectedPublishedRevision: 0,
	});
	const upload = await pending(s);
	const other = await s.t.run((ctx) =>
		ctx.db.insert('projects', {
			organizationId: s.ids.organizationId,
			name: 'Keep',
			slug: 'keep',
			visibility: 'private',
		})
	);
	const board = await s.t.run((ctx) =>
		ctx.db.insert('feedbackBoards', {
			projectId: s.ids.projectId,
			name: 'Board',
			slug: 'board',
		})
	);
	await s.owner.mutation(api.feedback.create, {
		projectId: s.ids.projectId,
		boardId: board,
		title: 'Delete me',
		firstComment: 'Initial',
	});
	const update = await s.owner.mutation(api.updates.save, s.fields);
	const seeded = await s.t.run(async (ctx) => {
		const feedback = (await ctx.db.query('feedback').first())!;
		for (let i = 0; i < 130; i++) {
			await ctx.db.insert('feedbackComments', {
				feedbackId: feedback._id,
				authorProfileId: s.ids.ownerProfile,
				content: `Comment ${i}`,
				initial: false,
			});
		}
		for (let i = 0; i < 105; i++) {
			await ctx.db.insert('updateComments', {
				updateId: update.id,
				authorProfileId: s.ids.ownerProfile,
				content: `Update comment ${i}`,
				emoteCounts: {},
			});
		}
		const membershipId = await ctx.db.insert('memberships', {
			organizationId: s.ids.organizationId,
			userId: s.ids.reader,
			role: 'moderator',
		});
		await ctx.db.insert('projectModeratorAssignments', {
			membershipId,
			projectId: s.ids.projectId,
		});
		await ctx.db.insert('projectMembers', { userId: s.ids.reader, projectId: s.ids.projectId });
		const invitationId = await ctx.db.insert('invitations', {
			organizationId: s.ids.organizationId,
			email: 'pending@example.test',
			role: 'moderator',
			projectIds: [s.ids.projectId, other],
			inviterId: s.ids.owner,
			expiresAt: Date.now() + 100000,
			status: 'pending',
		});
		return { feedbackId: feedback._id, invitationId };
	});
	await expect(
		s.reader.mutation(api.projectDeletion.remove, { id: s.ids.projectId })
	).rejects.toThrow('FORBIDDEN');
	await expect(s.t.mutation(api.projectDeletion.remove, { id: s.ids.projectId })).rejects.toThrow(
		'UNAUTHORIZED'
	);
	await s.owner.mutation(api.projectDeletion.remove, { id: s.ids.projectId });
	await s.owner.mutation(api.projectDeletion.remove, { id: s.ids.projectId }); // idempotent resume
	expect(
		await s.owner.query(api.projects.getBySlugs, {
			organizationSlug: 'org',
			projectSlug: 'project',
		})
	).toBeNull();
	await expect(s.owner.mutation(api.updates.save, s.fields)).rejects.toThrow();
	await expect(
		s.owner.mutation(api.policy.updateProject, { projectId: s.ids.projectId, name: 'Revive' })
	).rejects.toThrow();
	await expect(pending(s)).rejects.toThrow();
	await s.t.mutation(internal.filesProjectPurge.batch, { projectId: s.ids.projectId });
	const jobs = (
		await s.owner.query(api.filesJobs.list, {
			projectId: s.ids.projectId,
			state: 'pending',
			paginationOpts: page,
		})
	).page;
	expect(jobs).toHaveLength(1);
	await s.t.run((ctx) =>
		ctx.db.patch('storageCleanupJobs', jobs[0]._id, { state: 'failed', attempt: 3 })
	);
	for (let i = 0; i < 15; i++)
		await s.t.mutation(internal.projectDeletion.batch, { projectId: s.ids.projectId });
	expect(await s.t.run((ctx) => ctx.db.get('projects', s.ids.projectId))).not.toBeNull();
	expect(await s.t.run((ctx) => ctx.db.get('feedback', seeded.feedbackId))).toBeNull();
	expect(await s.t.run((ctx) => ctx.db.get('updates', update.id))).toBeNull();
	expect(
		(await s.t.run((ctx) => ctx.db.get('invitations', seeded.invitationId)))?.projectIds
	).toEqual([other]);
	await s.owner.mutation(api.filesJobs.resume, { jobId: jobs[0]._id });
	vi.setSystemTime(jobs[0].notBefore + 1);
	const claimed = await s.t.mutation(internal.filesJobs.claim, { jobId: jobs[0]._id });
	await s.t.mutation(internal.filesJobs.acknowledge, {
		jobId: jobs[0]._id,
		attempt: claimed!.job.attempt,
	});
	await s.t.mutation(internal.filesProjectPurge.batch, { projectId: s.ids.projectId });
	await s.t.mutation(internal.projectDeletion.batch, { projectId: s.ids.projectId });
	await s.t.mutation(internal.projectDeletion.batch, { projectId: s.ids.projectId }); // late duplicate safe
	expect(await s.t.run((ctx) => ctx.db.get('projects', s.ids.projectId))).toBeNull();
	expect(await s.t.run((ctx) => ctx.db.get('projects', other))).not.toBeNull();
	expect(await s.t.run((ctx) => ctx.db.get('fileObjects', upload.objectId))).toBeNull();
	for (const table of [
		'projectThemes',
		'feedbackComments',
		'feedbackTimelineEntries',
		'updateComments',
		'updateDeletionJobs',
		'projectModeratorAssignments',
		'projectMembers',
		'fileAssets',
		'storageUsage',
		'storageCleanupJobs',
		'projectDeletionJobs',
	] as const)
		expect(await s.t.run((ctx) => ctx.db.query(table).collect())).toEqual([]);
});

test('archived project deletion scrubs multiple invitation pages and cancels empty moderator grants', async () => {
	const s = await fixture();
	await s.t.run(async (ctx) => {
		await ctx.db.patch('projects', s.ids.projectId, { visibility: 'archived' });
		for (let i = 0; i < 105; i++)
			await ctx.db.insert('invitations', {
				organizationId: s.ids.organizationId,
				email: `invite-${i}@example.test`,
				role: 'moderator',
				projectIds: [s.ids.projectId],
				inviterId: s.ids.owner,
				expiresAt: Date.now() + 10000,
				status: 'pending',
			});
	});
	await s.owner.mutation(api.projectDeletion.remove, { id: s.ids.projectId });
	await s.t.mutation(internal.filesProjectPurge.batch, { projectId: s.ids.projectId });
	for (let i = 0; i < 5; i++)
		await s.t.mutation(internal.projectDeletion.batch, { projectId: s.ids.projectId });
	expect(await s.t.run((ctx) => ctx.db.get('projects', s.ids.projectId))).toBeNull();
	const invitations = await s.t.run((ctx) => ctx.db.query('invitations').collect());
	expect(invitations).toHaveLength(105);
	expect(invitations.every((i) => i.status === 'cancelled' && !i.projectIds.length)).toBe(true);
});

test('cleanup can resume after archival/deletion fencing, but not by a reader', async () => {
	const s = await fixture();
	const intent = await pending(s);
	// Model an exhausted external cleanup while the containing project is fenced.
	await s.t.run(async (ctx) => {
		const obj = await ctx.db.get('fileObjects', intent.objectId);
		await ctx.db.patch('fileObjects', obj!._id, { state: 'deleting' });
		await ctx.db.patch('fileAssets', intent.assetId, { state: 'deleting' });
		await ctx.db.insert('storageCleanupJobs', {
			projectId: s.ids.projectId,
			objectId: intent.objectId,
			state: 'failed',
			attempt: 3,
			maxAttempt: 3,
			leaseUntil: 0,
			notBefore: 0,
			stagingOnly: false,
		});
		await ctx.db.patch('projects', s.ids.projectId, {
			visibility: 'archived',
			storageDeletingAt: Date.now(),
		});
	});
	const job = (
		await s.owner.query(api.filesJobs.list, {
			projectId: s.ids.projectId,
			state: 'failed',
			paginationOpts: page,
		})
	).page[0];
	await expect(s.reader.mutation(api.filesJobs.resume, { jobId: job._id })).rejects.toThrow();
	await s.owner.mutation(api.filesJobs.resume, { jobId: job._id });
	expect((await s.t.run((ctx) => ctx.db.get('storageCleanupJobs', job._id)))?.state).toBe(
		'pending'
	);
});

test('shared Files views preserve folders during rename, filters, details and tenant isolation', async () => {
	const s = await fixture();
	const intent = await pending(s);
	await finish(s, intent.assetId);
	const folder = await s.owner.mutation(api.files.saveFolder, {
		projectId: s.ids.projectId,
		name: 'Work',
	});
	await s.owner.mutation(api.filesWorkspace.changeAsset, {
		assetId: intent.assetId,
		folderId: folder,
	});
	await s.owner.mutation(api.filesWorkspace.changeAsset, {
		assetId: intent.assetId,
		name: 'renamed',
	});
	const detail = await s.owner.query(api.filesWorkspace.detail, {
		assetId: intent.assetId,
		projectId: s.ids.projectId,
	});
	expect(detail?.folder?.id).toBe(folder);
	expect(detail?.name).toBe('renamed.txt');
	expect(detail?.uploadedBy?.name).toBe('Owner');
	expect(detail?.sizeBytes).toBe(12);
	const args = { projectId: s.ids.projectId, paginationOpts: page };
	expect(
		(
			await s.t.query(api.filesWorkspace.list, {
				...args,
				extension: 'txt',
				sourceProvider: 'kino',
			})
		).page
	).toHaveLength(1);
	expect(
		(await s.t.query(api.filesWorkspace.list, { ...args, extension: 'png' })).page
	).toHaveLength(0);
	expect(
		(await s.t.query(api.filesWorkspace.list, { ...args, sourceProvider: 'github' })).page
	).toHaveLength(0);
	expect(
		(
			await s.t.query(api.filesWorkspace.list, {
				...args,
				search: 'renamed',
				category: 'text',
				extension: 'txt',
			})
		).page
	).toHaveLength(1);
	const foreign = await s.t.run((ctx) =>
		ctx.db.insert('projects', {
			organizationId: s.ids.organizationId,
			name: 'Other',
			slug: 'other',
			visibility: 'private',
		})
	);
	expect(
		await s.owner.query(api.filesWorkspace.detail, { assetId: intent.assetId, projectId: foreign })
	).toBeNull();
	await s.owner.mutation(api.policy.updateProject, {
		projectId: s.ids.projectId,
		visibility: 'private',
	});
	await expect(
		s.reader.query(api.filesWorkspace.tree, { projectId: s.ids.projectId })
	).rejects.toThrow();
	await expect(
		s.owner.mutation(api.files.saveFolder, { projectId: s.ids.projectId, name: 'Updates' })
	).rejects.toThrow('FOLDER_NAME_TAKEN');
});

async function pending(s: Awaited<ReturnType<typeof fixture>>, extra: Record<string, never> = {}) {
	return (
		await s.owner.mutation(internal.files.reserveUpload, {
			projectId: s.ids.projectId,
			files: [{ name: 'notes.txt', mimeType: 'text/plain', sizeBytes: 12 }],
			...extra,
		})
	)[0];
}
test('project storage purge fences writes and waits for every external acknowledgment across batches', async () => {
	const s = await fixture();
	const uploaded = [];
	for (let batch = 0; batch < 3; batch++)
		uploaded.push(
			...(await s.owner.mutation(internal.files.reserveUpload, {
				projectId: s.ids.projectId,
				files: Array.from({ length: 10 }, (_, i) => ({
					name: `batch-${batch}-${i}.txt`,
					mimeType: 'text/plain',
					sizeBytes: 12,
				})),
			}))
		);
	await s.t.mutation(internal.filesProjectPurge.begin, { projectId: s.ids.projectId });
	await expect(pending(s)).rejects.toThrow('PROJECT_NOT_FOUND');
	await s.t.mutation(internal.filesProjectPurge.batch, { projectId: s.ids.projectId });
	await s.t.mutation(internal.filesProjectPurge.batch, { projectId: s.ids.projectId });
	let state = await s.t.run((ctx) =>
		ctx.db
			.query('storageProjectPurges')
			.withIndex('by_projectId', (q) => q.eq('projectId', s.ids.projectId))
			.unique()
	);
	expect(state?.done).toBe(false);
	const jobs = (
		await s.owner.query(api.filesJobs.list, {
			projectId: s.ids.projectId,
			state: 'pending',
			paginationOpts: { cursor: null, numItems: 100 },
		})
	).page;
	expect(jobs).toHaveLength(30);
	vi.setSystemTime(Math.max(...jobs.map((j) => j.notBefore)) + 1);
	for (const job of jobs) {
		const claim = (await s.t.mutation(internal.filesJobs.claim, { jobId: job._id }))!;
		await s.t.mutation(internal.filesJobs.acknowledge, {
			jobId: job._id,
			attempt: claim.job.attempt,
		});
	}
	await s.t.mutation(internal.filesProjectPurge.batch, { projectId: s.ids.projectId });
	state = await s.t.run((ctx) =>
		ctx.db
			.query('storageProjectPurges')
			.withIndex('by_projectId', (q) => q.eq('projectId', s.ids.projectId))
			.unique()
	);
	expect(state?.done).toBe(true);
	expect(
		(await s.owner.query(api.files.usage, { projectId: s.ids.projectId })).usage?.reservedBytes
	).toBe(0);
});
async function finish(
	s: Awaited<ReturnType<typeof fixture>>,
	assetId: Awaited<ReturnType<typeof pending>>['assetId']
) {
	const claim = await s.owner.mutation(internal.files.claimUpload, { assetId });
	expect(claim).not.toBeNull();
	return s.owner.mutation(internal.files.finishUpload, {
		objectId: claim!.object._id,
		attempt: claim!.attempt,
		bytes: claim!.object.declaredBytes,
		mimeType: claim!.object.mimeType,
		extractedText: 'searchable contents',
	});
}
test('uploads enforce actor, archive, size, MIME and quota; reservations roll back atomically', async () => {
	const s = await fixture();
	const args = {
		projectId: s.ids.projectId,
		files: [{ name: 'notes.txt', mimeType: 'text/plain', sizeBytes: 12 }],
	};
	await expect(s.t.mutation(internal.files.reserveUpload, args)).rejects.toThrow('UNAUTHORIZED');
	await expect(s.reader.mutation(internal.files.reserveUpload, args)).rejects.toThrow('FORBIDDEN');
	await expect(
		s.owner.mutation(internal.files.reserveUpload, {
			...args,
			files: [{ name: 'bad.exe', mimeType: 'text/plain', sizeBytes: 1 }],
		})
	).rejects.toThrow('INVALID_FILE');
	await expect(
		s.owner.mutation(internal.files.reserveUpload, {
			...args,
			files: [{ name: 'a.png', mimeType: 'text/plain', sizeBytes: 1 }],
		})
	).rejects.toThrow('INVALID_FILE');
	await s.t.run(async (ctx) => {
		await ctx.db.insert('storageUsage', {
			projectId: s.ids.projectId,
			organizationId: s.ids.organizationId,
			usedBytes: 100 * 1024 * 1024 - 10,
			reservedBytes: 0,
			fileCount: 1,
			byCategory: {},
			byOrigin: {},
			byUploaderClass: {},
		});
	});
	await expect(s.owner.mutation(internal.files.reserveUpload, args)).rejects.toThrow(
		'FILE_STORAGE_LIMIT'
	);
	expect(
		(await s.owner.query(api.files.usage, { projectId: s.ids.projectId })).usage?.reservedBytes
	).toBe(0);
	await s.owner.mutation(api.policy.updateProject, {
		projectId: s.ids.projectId,
		visibility: 'archived',
	});
	await expect(s.owner.mutation(internal.files.reserveUpload, args)).rejects.toThrow(
		'PROJECT_ARCHIVED'
	);
});
test('completion commits accounting once, retains staging cleanup, and search hides pending/private assets', async () => {
	const s = await fixture();
	const item = await pending(s);
	expect(
		(await s.owner.query(api.files.usage, { projectId: s.ids.projectId })).usage?.reservedBytes
	).toBe(12);
	expect(
		(await s.t.query(api.files.list, { projectId: s.ids.projectId, paginationOpts: page })).page
	).toHaveLength(0);
	expect(await finish(s, item.assetId)).toBe(true);
	expect(await s.owner.mutation(internal.files.claimUpload, { assetId: item.assetId })).toBeNull();
	const usage = (await s.owner.query(api.files.usage, { projectId: s.ids.projectId })).usage!;
	expect(usage).toMatchObject({
		usedBytes: 12,
		reservedBytes: 0,
		fileCount: 1,
		byCategory: { text: { bytes: 12, files: 1 } },
		byOrigin: { files: { bytes: 12, files: 1 } },
		byUploaderClass: { staff: { bytes: 12, files: 1 } },
	});
	expect(
		(
			await s.t.query(api.files.list, {
				projectId: s.ids.projectId,
				search: 'searchable',
				paginationOpts: page,
			})
		).page
	).toHaveLength(1);
	await s.t.run((ctx) =>
		ctx.db.patch('fileAssets', item.assetId, { access: 'private_user', listing: 'unlisted' })
	);
	await expect(s.reader.query(api.files.detail, { assetId: item.assetId })).rejects.toThrow(
		'FORBIDDEN'
	);
	expect(
		(
			await s.t.query(api.files.list, {
				projectId: s.ids.projectId,
				search: 'searchable',
				paginationOpts: page,
			})
		).page
	).toHaveLength(0);
});
test('revocation during processing fences commit and retains reservation until physical cleanup acknowledgment', async () => {
	const s = await fixture();
	const item = await pending(s);
	const claim = (await s.owner.mutation(internal.files.claimUpload, { assetId: item.assetId }))!;
	await s.owner.mutation(api.policy.updateProject, {
		projectId: s.ids.projectId,
		visibility: 'archived',
	});
	expect(
		await s.owner.mutation(internal.files.finishUpload, {
			objectId: item.objectId,
			attempt: claim.attempt,
			bytes: 12,
			mimeType: 'text/plain',
		})
	).toBe(false);
	expect(
		(await s.owner.query(api.files.usage, { projectId: s.ids.projectId })).usage?.reservedBytes
	).toBe(12);
});
test('deletion is fenced, waits out late PUTs, retries by lease and releases dimensions exactly once', async () => {
	const s = await fixture();
	const item = await pending(s);
	await finish(s, item.assetId);
	await s.owner.mutation(api.files.remove, { assetId: item.assetId });
	await expect(s.owner.query(api.files.detail, { assetId: item.assetId })).rejects.toThrow(
		'FILE_NOT_FOUND'
	);
	const job = (
		await s.owner.query(api.filesJobs.list, {
			projectId: s.ids.projectId,
			state: 'pending',
			paginationOpts: page,
		})
	).page.find((j) => !j.stagingOnly)!;
	expect(await s.t.mutation(internal.filesJobs.claim, { jobId: job._id })).toBeNull();
	vi.setSystemTime(job.notBefore + 1);
	const claim = (await s.t.mutation(internal.filesJobs.claim, { jobId: job._id }))!;
	expect(claim.keys).toHaveLength(3);
	await s.t.mutation(internal.filesJobs.fail, { jobId: job._id, attempt: claim.job.attempt });
	expect(
		(await s.owner.query(api.files.usage, { projectId: s.ids.projectId })).usage?.usedBytes
	).toBe(12);
	await s.t.mutation(internal.filesJobs.acknowledge, {
		jobId: job._id,
		attempt: claim.job.attempt + 1,
	});
	expect(
		(await s.owner.query(api.files.usage, { projectId: s.ids.projectId })).usage?.usedBytes
	).toBe(12);
	await s.t.mutation(internal.filesJobs.acknowledge, {
		jobId: job._id,
		attempt: claim.job.attempt,
	});
	await s.t.mutation(internal.filesJobs.acknowledge, {
		jobId: job._id,
		attempt: claim.job.attempt,
	});
	expect(
		(await s.owner.query(api.files.usage, { projectId: s.ids.projectId })).usage
	).toMatchObject({
		usedBytes: 0,
		reservedBytes: 0,
		fileCount: 0,
		byCategory: {},
		byOrigin: {},
		byUploaderClass: {},
	});
});
test('cover replacement preserves old cover until commit; references block deletion and update deletion schedules cleanup', async () => {
	const s = await fixture();
	const update = await s.owner.mutation(api.updates.save, s.fields);
	const args = {
		projectId: s.ids.projectId,
		updateId: update.id,
		files: [{ name: 'cover.png', mimeType: 'image/png', sizeBytes: 12 }],
	};
	const first = (await s.owner.mutation(internal.files.reserveUpload, args))[0];
	await finish(s, first.assetId);
	await expect(s.owner.mutation(api.files.remove, { assetId: first.assetId })).rejects.toThrow(
		'FILE_IN_USE'
	);
	const second = (await s.owner.mutation(internal.files.reserveUpload, args))[0];
	expect(
		(await s.owner.query(api.updates.detail, { projectId: s.ids.projectId, slug: update.slug }))
			?.update.coverAssetId
	).toBe(first.assetId);
	await finish(s, second.assetId);
	expect(
		(await s.owner.query(api.updates.detail, { projectId: s.ids.projectId, slug: update.slug }))
			?.update.coverAssetId
	).toBe(second.assetId);
	const asset = await s.t.run((ctx) => ctx.db.get('fileAssets', second.assetId));
	expect(await s.t.query(api.files.publicMetadata, { publicId: asset!.publicId })).toBeNull();
	await s.owner.mutation(api.updates.changeStatus, {
		projectId: s.ids.projectId,
		ids: [update.id],
		status: 'published',
	});
	expect(await s.t.query(api.files.publicMetadata, { publicId: asset!.publicId })).not.toBeNull();
	await s.owner.mutation(api.updates.remove, { projectId: s.ids.projectId, ids: [update.id] });
	expect(await s.t.query(api.files.publicMetadata, { publicId: asset!.publicId })).toBeNull();
	await s.t.mutation(internal.updates.deleteBatch, { id: update.id });
	expect((await s.t.run((ctx) => ctx.db.get('fileAssets', second.assetId)))?.state).toBe(
		'deleting'
	);
});
test('folder names, cycle/depth limits, foreign parents and nonempty deletion are enforced', async () => {
	const s = await fixture();
	const root = await s.owner.mutation(api.files.saveFolder, {
		projectId: s.ids.projectId,
		name: 'Root',
	});
	const child = await s.owner.mutation(api.files.saveFolder, {
		projectId: s.ids.projectId,
		parentId: root,
		name: 'Child',
	});
	await expect(
		s.owner.mutation(api.files.saveFolder, { projectId: s.ids.projectId, name: 'ROOT' })
	).rejects.toThrow('FOLDER_NAME_TAKEN');
	await expect(
		s.owner.mutation(api.files.saveFolder, {
			projectId: s.ids.projectId,
			folderId: root,
			parentId: child,
			name: 'Root',
		})
	).rejects.toThrow('INVALID_FOLDER_CYCLE');
	await expect(s.owner.mutation(api.files.removeFolder, { folderId: root })).rejects.toThrow(
		'FOLDER_NOT_EMPTY'
	);
	const foreign = await s.t.run((ctx) =>
		ctx.db.insert('projects', {
			organizationId: s.ids.organizationId,
			name: 'Foreign',
			slug: 'foreign',
			visibility: 'private',
		})
	);
	await expect(
		s.owner.mutation(api.files.saveFolder, { projectId: foreign, parentId: root, name: 'No' })
	).rejects.toThrow('FOLDER_NOT_FOUND');
	let parent = child;
	for (let i = 0; i < 10; i++)
		parent = await s.owner.mutation(api.files.saveFolder, {
			projectId: s.ids.projectId,
			parentId: parent,
			name: `Nested ${i}`,
		});
	await expect(
		s.owner.mutation(api.files.saveFolder, {
			projectId: s.ids.projectId,
			parentId: parent,
			name: 'Too deep',
		})
	).rejects.toThrow('FOLDER_DEPTH_EXCEEDED');
});
