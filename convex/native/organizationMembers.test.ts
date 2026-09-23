// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';

import { configureTestAuth, issuer } from '../testing/setup.testing';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.testing.ts']);

test('only managers replace moderator grants; zero revokes access and invalid grants roll back', async () => {
	await configureTestAuth();
	const t = convexTest(schema, modules);
	const fixture = await t.run(async (ctx) => {
		const owner = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const moderator = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const organizationId = await ctx.db.insert('organizations', {
			name: 'Org',
			slug: 'org',
			visibility: 'public',
		});
		const otherOrg = await ctx.db.insert('organizations', {
			name: 'Other',
			slug: 'other',
			visibility: 'public',
		});
		const ownerMember = await ctx.db.insert('memberships', {
			organizationId,
			userId: owner,
			role: 'owner',
		});
		const memberId = await ctx.db.insert('memberships', {
			organizationId,
			userId: moderator,
			role: 'moderator',
		});
		const projectId = await ctx.db.insert('projects', {
			organizationId,
			name: 'Private',
			slug: 'private',
			visibility: 'private',
		});
		const foreignProject = await ctx.db.insert('projects', {
			organizationId: otherOrg,
			name: 'Foreign',
			slug: 'foreign',
			visibility: 'private',
		});
		await ctx.db.insert('projectModeratorAssignments', { membershipId: memberId, projectId });
		return { owner, moderator, ownerMember, memberId, projectId, foreignProject };
	});
	const owner = t.withIdentity({ issuer, subject: fixture.owner });
	const moderator = t.withIdentity({ issuer, subject: fixture.moderator });
	const args = { memberId: fixture.memberId };
	await expect(
		moderator.query(api.organizationMembers.getModeratorProjectAccess, args)
	).rejects.toThrow('FORBIDDEN');
	await expect(
		moderator.mutation(api.organizationMembers.setModeratorProjectAccess, {
			...args,
			projectIds: [],
		})
	).rejects.toThrow('FORBIDDEN');
	await expect(
		owner.mutation(api.organizationMembers.setModeratorProjectAccess, {
			memberId: fixture.ownerMember,
			projectIds: [],
		})
	).rejects.toThrow('FORBIDDEN');
	await expect(
		owner.mutation(api.organizationMembers.setModeratorProjectAccess, {
			...args,
			projectIds: [fixture.foreignProject],
		})
	).rejects.toThrow('INVALID_ASSIGNMENTS');
	expect(
		(await owner.query(api.organizationMembers.getModeratorProjectAccess, args)).projects
	).toEqual([expect.objectContaining({ id: fixture.projectId, assigned: true })]);
	await owner.mutation(api.organizationMembers.setModeratorProjectAccess, {
		...args,
		projectIds: [],
	});
	expect(
		(await owner.query(api.organizationMembers.getModeratorProjectAccess, args)).projects[0]
			.assigned
	).toBe(false);
	await expect(
		moderator.mutation(api.policy.assertContentWrite, { projectId: fixture.projectId })
	).rejects.toThrow('FORBIDDEN');
	await owner.mutation(api.organizationMembers.setModeratorProjectAccess, {
		...args,
		projectIds: [fixture.projectId],
	});
	await moderator.mutation(api.policy.assertContentWrite, { projectId: fixture.projectId });
});
