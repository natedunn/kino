// @vitest-environment edge-runtime
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { configureTestAuth, issuer } from '../testing/setup.testing';
import { api } from './_generated/api';
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

test('original Updates views preserve comment windows, labels, publication access and edit fields', async () => {
	const s = await fixture();
	const created = await s.owner.mutation(api.updates.save, s.fields);
	for (let i = 0; i < 24; i++)
		await s.owner.mutation(api.updates.saveComment, {
			updateId: created.id,
			content: `Comment ${i}`,
		});
	const args = { projectId: s.ids.projectId, slug: created.slug };
	expect(await s.reader.query(api.updatesWorkspace.detail, args)).toBeNull();
	let detail = (await s.owner.query(api.updatesWorkspace.detail, args))!;
	expect(detail.commentWindow.head).toHaveLength(5);
	expect(detail.commentWindow.tail).toHaveLength(10);
	expect(detail.commentWindow.middleCursor).toBeTruthy();
	const middle = await s.owner.query(api.updatesWorkspace.middleComments, {
		updateId: created.id,
		cursor: detail.commentWindow.middleCursor!,
		tailCommentIds: detail.commentWindow.tailCommentIds,
	});
	expect(middle.comments).toHaveLength(9);
	expect(middle.nextCursor).toBeNull();
	const comments = [...detail.commentWindow.head, ...middle.comments, ...detail.commentWindow.tail];
	expect(comments.map((c) => c.content)).toEqual(
		Array.from({ length: 24 }, (_, i) => `Comment ${i}`)
	);
	expect(comments.every((c) => typeof c.createdAt === 'number')).toBe(true);
	await s.owner.mutation(api.updatesWorkspace.change, {
		id: created.id,
		title: 'Renamed without losing content',
	});
	detail = (await s.owner.query(api.updatesWorkspace.detail, args))!;
	expect(detail.update.content).toBe(s.fields.content);
	expect(detail.update.tags).toEqual(s.fields.tags);
	await expect(
		s.reader.mutation(api.updatesWorkspace.change, { id: created.id, title: 'Denied' })
	).rejects.toThrow();
	await s.owner.mutation(api.updatesWorkspace.changeStatus, {
		id: created.id,
		status: 'published',
	});
	expect(
		(await s.t.query(api.updatesWorkspace.featured, { projectId: s.ids.projectId })).items[0].id
	).toBe(created.id);
	await s.reader.mutation(api.updatesWorkspace.toggleComment, {
		updateCommentId: comments[8].id,
		content: 'heart',
	});
	const reacted = await s.reader.query(api.updatesWorkspace.middleComments, {
		updateId: created.id,
		cursor: detail.commentWindow.middleCursor!,
		tailCommentIds: detail.commentWindow.tailCommentIds,
	});
	expect(reacted.comments.find((c) => c.id === comments[8].id)?.emoteCounts.heart.count).toBe(1);
	await expect(
		s.reader.mutation(api.updatesWorkspace.changeComment, {
			id: comments[8].id,
			content: 'not mine',
		})
	).rejects.toThrow('FORBIDDEN');
	await s.owner.mutation(api.updatesWorkspace.changeStatus, { id: created.id, status: 'draft' });
	expect(
		await s.reader.query(api.updatesWorkspace.interactive, {
			projectId: s.ids.projectId,
			updateId: created.id,
		})
	).toBeNull();
	expect(
		(
			await s.reader.query(api.updatesWorkspace.middleComments, {
				updateId: created.id,
				cursor: detail.commentWindow.middleCursor!,
			})
		).comments
	).toEqual([]);
});

test('related-feedback view resolves selected names outside search and hides inaccessible projects', async () => {
	const s = await fixture();
	const [own, other] = await s.t.run(async (ctx) => {
		const privateProject = await ctx.db.insert('projects', {
			organizationId: s.ids.organizationId,
			name: 'Private',
			slug: 'private',
			visibility: 'private',
		});
		const ids = [];
		for (const projectId of [s.ids.projectId, privateProject]) {
			const boardId = await ctx.db.insert('feedbackBoards', {
				projectId,
				name: 'Requests',
				slug: 'requests',
			});
			ids.push(
				await ctx.db.insert('feedback', {
					projectId,
					boardId,
					authorProfileId: s.ids.ownerProfile,
					slug: projectId,
					title: 'Selected readable name',
					status: 'open',
					priority: 'none',
					tags: [],
					upvotes: 0,
					searchContent: 'Selected readable name',
					updatedAt: Date.now(),
				})
			);
		}
		return ids;
	});
	const result = await s.reader.query(api.updatesWorkspace.feedbackByIds, { ids: [own, other] });
	expect(result.map((f) => f.id)).toEqual([own]);
	expect(result[0].title).toBe('Selected readable name');
	expect(result[0].board?.name).toBe('Requests');
});

test('drafts stay private across detail/list/search/comments; publish and unpublish change access immediately', async () => {
	const s = await fixture();
	const created = await s.owner.mutation(api.updates.save, s.fields);
	const query = { projectId: s.ids.projectId, slug: created.slug };
	expect(await s.t.query(api.updates.detail, query)).toBeNull();
	expect(
		(
			await s.reader.query(api.updates.list, {
				projectId: s.ids.projectId,
				search: 'Searchable',
				paginationOpts: page,
			})
		).page
	).toHaveLength(0);
	await expect(
		s.reader.mutation(api.updates.saveComment, { updateId: created.id, content: 'No' })
	).rejects.toThrow('UPDATE_NOT_FOUND');
	await s.owner.mutation(api.updates.changeStatus, {
		projectId: s.ids.projectId,
		ids: [created.id],
		status: 'published',
	});
	expect((await s.t.query(api.updates.detail, query))?.update.title).toBe('Update');
	await s.reader.mutation(api.updates.saveComment, {
		updateId: created.id,
		content: 'Public discussion',
	});
	await s.owner.mutation(api.updates.changeStatus, {
		projectId: s.ids.projectId,
		ids: [created.id],
		status: 'draft',
	});
	expect(
		(await s.reader.query(api.updates.comments, { updateId: created.id, paginationOpts: page }))
			.page
	).toHaveLength(0);
	await expect(
		s.reader.mutation(api.updates.toggleReaction, { updateId: created.id, content: 'heart' })
	).rejects.toThrow('UPDATE_NOT_FOUND');
});

test('create and edit index visible update text without script/style content or HTML entities', async () => {
	const s = await fixture();
	const created = await s.owner.mutation(api.updates.save, {
		...s.fields,
		content: '<script>hiddencreate</script><p>Ship &amp; sail</p>',
		publish: true,
	});
	const search = async (term: string) =>
		(
			await s.reader.query(api.updates.list, {
				projectId: s.ids.projectId,
				search: term,
				paginationOpts: page,
			})
		).page.map((item) => item.update._id);
	expect(await search('sail')).toEqual([created.id]);
	expect(await search('hiddencreate')).toEqual([]);
	await s.owner.mutation(api.updatesWorkspace.change, {
		id: created.id,
		content: '<style>hiddenedit</style><p>Launch &amp; land</p>',
	});
	expect(await search('land')).toEqual([created.id]);
	expect(await search('sail')).toEqual([]);
	expect(await search('hiddenedit')).toEqual([]);
});

test('validates fields and feedback ownership; preserves slug and featured timestamp while updating search', async () => {
	const s = await fixture();
	await expect(
		s.owner.mutation(api.updates.save, { ...s.fields, title: ' '.repeat(4) })
	).rejects.toThrow('INVALID_UPDATE');
	const created = await s.owner.mutation(api.updates.save, {
		...s.fields,
		featured: true,
		publish: true,
	});
	const first = await s.owner.query(api.updates.detail, {
		projectId: s.ids.projectId,
		slug: created.slug,
	});
	vi.advanceTimersByTime(1000);
	await s.owner.mutation(api.updates.save, {
		...s.fields,
		id: created.id,
		title: 'Renamed',
		content: 'Replacementneedle',
		featured: true,
	});
	const next = await s.owner.query(api.updates.detail, {
		projectId: s.ids.projectId,
		slug: created.slug,
	});
	expect(next?.update.featuredAt).toBe(first?.update.featuredAt);
	expect(next?.update.slug).toBe(created.slug);
	expect(
		(
			await s.t.query(api.updates.list, {
				projectId: s.ids.projectId,
				search: 'Replacementneedle',
				paginationOpts: page,
			})
		).page
	).toHaveLength(1);
	expect(
		(
			await s.t.query(api.updates.list, {
				projectId: s.ids.projectId,
				search: 'Searchable',
				paginationOpts: page,
			})
		).page
	).toHaveLength(0);
	await s.owner.mutation(api.updates.save, { ...s.fields, id: created.id, featured: false });
	expect(
		(await s.owner.query(api.updates.detail, { projectId: s.ids.projectId, slug: created.slug }))
			?.update.featuredAt
	).toBeUndefined();
	const foreign = await s.t.run(async (ctx) => {
		const projectId = await ctx.db.insert('projects', {
			organizationId: s.ids.organizationId,
			name: 'Other',
			slug: 'other',
			visibility: 'public',
		});
		const boardId = await ctx.db.insert('feedbackBoards', {
			projectId,
			name: 'Board',
			slug: 'board',
		});
		return ctx.db.insert('feedback', {
			projectId,
			boardId,
			authorProfileId: s.ids.ownerProfile,
			title: 'Foreign',
			slug: 'foreign',
			status: 'open',
			priority: 'none',
			tags: [],
			upvotes: 0,
			searchContent: 'Foreign',
			updatedAt: Date.now(),
		});
	});
	await expect(
		s.owner.mutation(api.updates.save, { ...s.fields, relatedFeedbackIds: [foreign] })
	).rejects.toThrow('INVALID_RELATED_FEEDBACK');
});

test('comment ownership, reactions, counts, and reply cleanup stay consistent', async () => {
	const s = await fixture();
	const created = await s.owner.mutation(api.updates.save, { ...s.fields, publish: true });
	const comment = await s.reader.mutation(api.updates.saveComment, {
		updateId: created.id,
		content: 'A comment',
	});
	await expect(
		s.owner.mutation(api.updates.saveComment, {
			updateId: created.id,
			id: comment,
			content: 'Not mine',
		})
	).rejects.toThrow('FORBIDDEN');
	await s.reader.mutation(api.updates.saveComment, {
		updateId: created.id,
		id: comment,
		content: 'Edited',
	});
	const reply = await s.owner.mutation(api.updates.saveComment, {
		updateId: created.id,
		replyCommentId: comment,
		content: 'Reply',
	});
	for (const content of ['heart', 'thumbsUp', 'explodingHead'] as const)
		await s.reader.mutation(api.updates.toggleReaction, {
			updateId: created.id,
			commentId: comment,
			content,
		});
	await s.reader.mutation(api.updates.toggleReaction, { updateId: created.id, content: 'heart' });
	await s.reader.mutation(api.updates.toggleReaction, { updateId: created.id, content: 'heart' });
	expect(
		(await s.reader.query(api.updates.detail, { projectId: s.ids.projectId, slug: created.slug }))
			?.update.heartCount
	).toBe(0);
	await s.owner.mutation(api.updates.removeComment, { id: comment });
	await s.t.finishAllScheduledFunctions(vi.runAllTimers);
	await s.t.run(async (ctx) => {
		expect((await ctx.db.get('updates', created.id))?.commentCount).toBe(1);
		expect((await ctx.db.get('updateComments', reply))?.replyCommentId).toBeUndefined();
		expect(await ctx.db.query('updateCommentEmotes').collect()).toHaveLength(0);
	});
});

test('private membership removal and archive state revoke every write', async () => {
	const s = await fixture();
	const created = await s.owner.mutation(api.updates.save, { ...s.fields, publish: true });
	const comment = await s.reader.mutation(api.updates.saveComment, {
		updateId: created.id,
		content: 'Before removal',
	});
	await s.t.run((ctx) => ctx.db.patch('projects', s.ids.projectId, { visibility: 'private' }));
	expect(
		await s.reader.query(api.updates.detail, { projectId: s.ids.projectId, slug: created.slug })
	).toBeNull();
	await expect(
		s.reader.mutation(api.updates.saveComment, {
			updateId: created.id,
			id: comment,
			content: 'No access',
		})
	).rejects.toThrow('UPDATE_NOT_FOUND');
	await expect(s.reader.mutation(api.updates.removeComment, { id: comment })).rejects.toThrow(
		'UPDATE_NOT_FOUND'
	);
	await s.t.run((ctx) => ctx.db.patch('projects', s.ids.projectId, { visibility: 'archived' }));
	await expect(s.owner.mutation(api.updates.save, { ...s.fields, id: created.id })).rejects.toThrow(
		'PROJECT_ARCHIVED'
	);
	await expect(
		s.owner.mutation(api.updates.changeStatus, {
			projectId: s.ids.projectId,
			ids: [created.id],
			status: 'draft',
		})
	).rejects.toThrow('PROJECT_ARCHIVED');
	await expect(
		s.owner.mutation(api.updates.toggleReaction, { updateId: created.id, content: 'heart' })
	).rejects.toThrow('PROJECT_ARCHIVED');
	await expect(
		s.owner.mutation(api.updates.remove, { projectId: s.ids.projectId, ids: [created.id] })
	).rejects.toThrow('PROJECT_ARCHIVED');
});

test('bulk changes reject cross-project ids atomically and anonymous writes fail', async () => {
	const s = await fixture();
	const first = await s.owner.mutation(api.updates.save, s.fields);
	const projectId = await s.t.run((ctx) =>
		ctx.db.insert('projects', {
			organizationId: s.ids.organizationId,
			name: 'Other',
			slug: 'other',
			visibility: 'public',
		})
	);
	const foreign = await s.owner.mutation(api.updates.save, { ...s.fields, projectId });
	await expect(
		s.owner.mutation(api.updates.changeStatus, {
			projectId: s.ids.projectId,
			ids: [first.id, foreign.id],
			status: 'published',
		})
	).rejects.toThrow('UPDATE_NOT_FOUND');
	expect((await s.t.run((ctx) => ctx.db.get('updates', first.id)))?.status).toBe('draft');
	await expect(
		s.owner.mutation(api.updates.remove, {
			projectId: s.ids.projectId,
			ids: [first.id, foreign.id],
		})
	).rejects.toThrow('UPDATE_NOT_FOUND');
	expect((await s.t.run((ctx) => ctx.db.get('updates', first.id)))?.deletingAt).toBeUndefined();
	await expect(s.t.mutation(api.updates.save, s.fields)).rejects.toThrow('UNAUTHORIZED');
	await expect(s.reader.mutation(api.updates.save, s.fields)).rejects.toThrow('FORBIDDEN');
});

test('large deletion fences writes and removes all comment/reaction rows in bounded batches', async () => {
	const s = await fixture();
	const created = await s.owner.mutation(api.updates.save, { ...s.fields, publish: true });
	await s.t.run(async (ctx) => {
		for (let i = 0; i < 240; i++) {
			const commentId = await ctx.db.insert('updateComments', {
				updateId: created.id,
				authorProfileId: s.ids.readerProfile,
				content: `Comment ${i}`,
				emoteCounts: { heart: 1 },
			});
			await ctx.db.insert('updateCommentEmotes', {
				updateId: created.id,
				commentId,
				authorProfileId: s.ids.ownerProfile,
				content: 'heart',
			});
		}
		await ctx.db.patch('updates', created.id, { commentCount: 240 });
	});
	await s.owner.mutation(api.updates.remove, { projectId: s.ids.projectId, ids: [created.id] });
	expect(
		await s.owner.query(api.updates.detail, { projectId: s.ids.projectId, slug: created.slug })
	).toBeNull();
	await expect(
		s.owner.mutation(api.updates.saveComment, { updateId: created.id, content: 'Too late' })
	).rejects.toThrow('UPDATE_NOT_FOUND');
	await s.t.finishAllScheduledFunctions(vi.runAllTimers);
	await s.t.run(async (ctx) => {
		expect(await ctx.db.get('updates', created.id)).toBeNull();
		for (const table of [
			'updateComments',
			'updateCommentEmotes',
			'updateEmotes',
			'updateDeletionJobs',
		] as const)
			expect(await ctx.db.query(table).collect()).toHaveLength(0);
	});
});

test('pagination is bounded, categories filter correctly, and featured never exposes drafts', async () => {
	const s = await fixture();
	for (let i = 0; i < 25; i++)
		await s.owner.mutation(api.updates.save, {
			...s.fields,
			title: `Update ${i}`,
			publish: true,
			category: i === 24 ? 'article' : 'changelog',
		});
	await s.owner.mutation(api.updates.save, {
		...s.fields,
		title: 'Featured draft',
		featured: true,
	});
	const first = await s.t.query(api.updates.list, {
		projectId: s.ids.projectId,
		paginationOpts: page,
	});
	expect(first.page).toHaveLength(20);
	const second = await s.t.query(api.updates.list, {
		projectId: s.ids.projectId,
		paginationOpts: { numItems: 20, cursor: first.continueCursor },
	});
	expect(second.page).toHaveLength(5);
	expect(new Set([...first.page, ...second.page].map((item) => item.update._id)).size).toBe(25);
	expect(
		(
			await s.t.query(api.updates.list, {
				projectId: s.ids.projectId,
				category: 'article',
				paginationOpts: page,
			})
		).page
	).toHaveLength(1);
	const featured = await s.owner.query(api.updates.featured, { projectId: s.ids.projectId });
	expect(featured).toHaveLength(3);
	expect(featured.every((item) => item.update.status === 'published')).toBe(true);
});

test('per-user write throttling rejects a burst', async () => {
	const s = await fixture();
	for (let i = 0; i < 60; i++)
		await s.owner.mutation(api.updates.save, { ...s.fields, title: `Update ${i}` });
	await expect(s.owner.mutation(api.updates.save, s.fields)).rejects.toThrow('RATE_LIMITED');
});
