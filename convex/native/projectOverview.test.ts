// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { beforeEach, expect, test } from 'vitest';

import { configureTestAuth, issuer } from '../testing/setup.testing';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.testing.ts']);
beforeEach(configureTestAuth);

test('overview uses project data and hides private projects from outsiders', async () => {
	const t = convexTest(schema, modules);
	const ids = await t.run(async (ctx) => {
		const owner = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const outsider = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const profile = await ctx.db.insert('profiles', {
			userId: owner,
			username: 'owner',
			name: 'Owner',
		});
		const organizationId = await ctx.db.insert('organizations', {
			name: 'Org',
			slug: 'org',
			visibility: 'private',
		});
		await ctx.db.insert('memberships', { organizationId, userId: owner, role: 'owner' });
		const projectId = await ctx.db.insert('projects', {
			organizationId,
			name: 'Project',
			slug: 'project',
			visibility: 'private',
		});
		const boardId = await ctx.db.insert('feedbackBoards', {
			projectId,
			name: 'Ideas',
			slug: 'ideas',
		});
		return { owner, outsider, profile, projectId, boardId };
	});
	const owner = t.withIdentity({ issuer, subject: ids.owner });
	const outsider = t.withIdentity({ issuer, subject: ids.outsider });

	expect(await outsider.query(api.projectOverview.get, { projectId: ids.projectId })).toBeNull();
	expect(await owner.query(api.projectOverview.get, { projectId: ids.projectId })).toMatchObject({
		stats: { openFeedback: 0, upvotes: 0, inProgress: 0, publishedUpdates: 0, members: 1 },
		members: [{ username: 'owner', role: 'owner' }],
		recentUpdates: [],
		activity: [],
	});

	await t.run(async (ctx) => {
		await ctx.db.insert('feedback', {
			projectId: ids.projectId,
			boardId: ids.boardId,
			authorProfileId: ids.profile,
			slug: 'real-feedback',
			title: 'Real feedback',
			status: 'open',
			priority: 'none',
			upvotes: 3,
			tags: [],
			searchContent: 'Real feedback',
			updatedAt: 1,
		});
		await ctx.db.insert('updates', {
			projectId: ids.projectId,
			authorProfileId: ids.profile,
			slug: 'real-update',
			title: 'Real update',
			content: 'Released',
			searchContent: 'Real update Released',
			category: 'announcement',
			status: 'published',
			tags: [],
			relatedFeedbackIds: [],
			publishedAt: 2,
			updatedAt: 2,
			commentCount: 1,
			heartCount: 0,
		});
	});
	const result = await owner.query(api.projectOverview.get, { projectId: ids.projectId });
	expect(result?.stats).toMatchObject({ openFeedback: 1, upvotes: 3, publishedUpdates: 1 });
	expect(result?.recentUpdates).toMatchObject([
		{ title: 'Real update', author: 'Owner', commentCount: 1 },
	]);
	expect(result?.activity.map((item) => item.title)).toContain('Real feedback');
	expect(result?.activity.map((item) => item.title)).toContain('Real update');
});
