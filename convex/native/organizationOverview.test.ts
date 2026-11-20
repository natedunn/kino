// @vitest-environment edge-runtime
import { registerCore } from '@convex-dev/auth/test';
import { convexTest } from 'convex-test';
import { beforeEach, expect, test } from 'vitest';

import { configureTestAuth, sessionFor } from '../testing/setup.testing';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.testing.ts']);
beforeEach(configureTestAuth);

test('organization summary counts members without exposing the roster or hidden projects', async () => {
	const t = convexTest(schema, modules);
	registerCore(t);
	const ids = await t.run(async (ctx) => {
		const owner = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const moderator = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const outsider = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const organizationId = await ctx.db.insert('organizations', {
			name: 'Private organization',
			slug: 'private-organization',
			visibility: 'private',
		});
		await ctx.db.insert('memberships', { organizationId, userId: owner, role: 'owner' });
		await ctx.db.insert('memberships', { organizationId, userId: moderator, role: 'moderator' });
		const visibleProjectId = await ctx.db.insert('projects', {
			organizationId,
			name: 'Assigned',
			slug: 'assigned',
			visibility: 'private',
		});
		await ctx.db.insert('projects', {
			organizationId,
			name: 'Hidden',
			slug: 'hidden',
			visibility: 'private',
		});
		const membership = await ctx.db
			.query('memberships')
			.withIndex('by_organizationId_and_userId', (q) =>
				q.eq('organizationId', organizationId).eq('userId', moderator)
			)
			.unique();
		await ctx.db.insert('projectModeratorAssignments', {
			membershipId: membership!._id,
			projectId: visibleProjectId,
		});
		return { organizationId, owner, moderator, outsider };
	});
	const owner = t.withIdentity(await sessionFor(t, ids.owner));
	const moderator = t.withIdentity(await sessionFor(t, ids.moderator));
	const outsider = t.withIdentity(await sessionFor(t, ids.outsider));
	const args = { organizationId: ids.organizationId };

	expect(await outsider.query(api.organizationOverview.get, args)).toBeNull();
	expect(await moderator.query(api.organizationOverview.get, args)).toEqual({ memberCount: 2 });
	expect(
		(await moderator.query(api.projects.listByOrganization, args)).map((row) => row.name)
	).toEqual(['Assigned']);
	expect((await owner.query(api.projects.listByOrganization, args)).map((row) => row.name)).toEqual(
		['Assigned', 'Hidden']
	);
});
