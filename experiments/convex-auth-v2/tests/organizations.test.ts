// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { expect, test } from 'vitest';

import schema from '../organizations/convex/schema';

const modules = import.meta.glob('../organizations/convex/**/*.{ts,js}');
const m = (name: string) => makeFunctionReference<'mutation'>(`organizations:${name}`);
const q = (name: string) => makeFunctionReference<'query'>(`organizations:${name}`);
async function setup() {
	const t = convexTest(schema, modules);
	const ids = await t.run(async (ctx) =>
		Promise.all(
			['owner', 'admin', 'moderator', 'other', 'unverified'].map((email) =>
				ctx.db.insert('users', { email, verified: email !== 'unverified' })
			)
		)
	);
	const [owner, admin, moderator, other, unverified] = ids.map((subject) =>
		t.withIdentity({ subject })
	);
	const org = await owner.mutation(m('create'), { name: 'Acme', slug: 'acme' });
	const foreignOrg = await other.mutation(m('create'), { name: 'Other', slug: 'other' });
	const project = await owner.mutation(m('createProject'), {
		organizationId: org,
		name: 'Assigned',
	});
	const hidden = await owner.mutation(m('createProject'), { organizationId: org, name: 'Hidden' });
	const foreign = await other.mutation(m('createProject'), {
		organizationId: foreignOrg,
		name: 'Foreign',
	});
	// Invitation acceptance is a subsequent proof; seed memberships at that boundary.
	const [adminId, modId] = await t.run(async (ctx) =>
		Promise.all([
			ctx.db.insert('memberships', { organizationId: org, userId: ids[1], role: 'admin' }),
			ctx.db.insert('memberships', { organizationId: org, userId: ids[2], role: 'moderator' }),
		])
	);
	await owner.mutation(m('setRole'), {
		membershipId: modId,
		role: 'moderator',
		projectIds: [project],
	});
	return {
		t,
		ids,
		owner,
		admin,
		moderator,
		other,
		unverified,
		org,
		foreignOrg,
		project,
		hidden,
		foreign,
		adminId,
		modId,
	};
}
test('creator becomes owner; duplicate slug cannot create a second organization', async () => {
	const s = await setup();
	expect((await s.owner.query(q('get'), { organizationId: s.org })).role).toBe('owner');
	await expect(s.other.mutation(m('create'), { name: 'Duplicate', slug: 'acme' })).rejects.toThrow(
		'SLUG_TAKEN'
	);
	expect(await s.t.run((ctx) => ctx.db.query('organizations').collect())).toHaveLength(2);
});
test('anonymous, unverified, and deleted identities are refused', async () => {
	const s = await setup();
	for (const client of [s.t, s.unverified]) {
		await expect(client.mutation(m('create'), { name: 'Bad', slug: 'bad' })).rejects.toThrow(
			'UNAUTHORIZED'
		);
		await expect(client.query(q('get'), { organizationId: s.org })).rejects.toThrow('UNAUTHORIZED');
		await expect(client.mutation(m('increment'), { projectId: s.project })).rejects.toThrow(
			'UNAUTHORIZED'
		);
	}
	await s.t.run((ctx) => ctx.db.delete(s.ids[4]));
	await expect(s.unverified.query(q('get'), { organizationId: s.org })).rejects.toThrow(
		'UNAUTHORIZED'
	);
});
test('paginated memberships scoped to caller; forged user argument rejected', async () => {
	const s = await setup();
	const args = { paginationOpts: { numItems: 10, cursor: null } };
	const result = await s.owner.query(q('listMine'), args);
	expect(result.page.map((row: { organization: { _id: string } }) => row.organization._id)).toEqual(
		[s.org]
	);
	await expect(s.other.query(q('get'), { organizationId: s.org })).rejects.toThrow('FORBIDDEN');
	await expect(s.other.query(q('listMine'), { ...args, userId: s.ids[0] })).rejects.toThrow();
});
test('moderator content access requires assignment and grants no organization management', async () => {
	const s = await setup();
	expect(await s.moderator.query(q('readProject'), { projectId: s.project })).toMatchObject({
		canManageContent: true,
		canEditSettings: true,
		canManageAccess: false,
		canManageIntegrations: false,
		canDelete: false,
	});
	await s.moderator.mutation(m('increment'), { projectId: s.project });
	expect((await s.owner.query(q('readProject'), { projectId: s.project })).project.value).toBe(1);
	for (const projectId of [s.hidden, s.foreign]) {
		await expect(s.moderator.query(q('readProject'), { projectId })).rejects.toThrow('FORBIDDEN');
		await expect(s.moderator.mutation(m('increment'), { projectId })).rejects.toThrow('FORBIDDEN');
	}
	await expect(
		s.moderator.mutation(m('createProject'), { organizationId: s.org, name: 'Bad' })
	).rejects.toThrow('FORBIDDEN');
	await expect(
		s.moderator.mutation(m('setRole'), { membershipId: s.modId, role: 'admin', projectIds: [] })
	).rejects.toThrow('FORBIDDEN');
});
test('admin can promote; foreign organization owner cannot change or remove membership', async () => {
	const s = await setup();
	await expect(s.other.mutation(m('remove'), { membershipId: s.adminId })).rejects.toThrow(
		'FORBIDDEN'
	);
	await expect(
		s.other.mutation(m('setRole'), {
			membershipId: s.adminId,
			role: 'moderator',
			projectIds: [s.project],
		})
	).rejects.toThrow('FORBIDDEN');
	await s.admin.mutation(m('setRole'), { membershipId: s.modId, role: 'admin', projectIds: [] });
	await s.moderator.mutation(m('increment'), { projectId: s.hidden });
	expect(await s.t.run((ctx) => ctx.db.query('assignments').collect())).toHaveLength(0);
});
test('invalid assignment replacement fails without losing prior access', async () => {
	const s = await setup();
	for (const projectIds of [[s.foreign], [s.project, s.project], [], Array(51).fill(s.project)]) {
		await expect(
			s.owner.mutation(m('setRole'), { membershipId: s.modId, role: 'moderator', projectIds })
		).rejects.toThrow('INVALID_ASSIGNMENTS');
	}
	await expect(
		s.owner.mutation(m('setRole'), {
			membershipId: s.modId,
			role: 'admin',
			projectIds: [s.project],
		})
	).rejects.toThrow('INVALID_ASSIGNMENTS');
	expect(await s.t.run((ctx) => ctx.db.query('assignments').collect())).toHaveLength(1);
	await s.moderator.mutation(m('increment'), { projectId: s.project });
});
test('same identity loses permissions immediately after reassignment, demotion and removal', async () => {
	const s = await setup();
	await s.owner.mutation(m('setRole'), {
		membershipId: s.modId,
		role: 'moderator',
		projectIds: [s.hidden],
	});
	await expect(s.moderator.mutation(m('increment'), { projectId: s.project })).rejects.toThrow(
		'FORBIDDEN'
	);
	await s.owner.mutation(m('setRole'), {
		membershipId: s.adminId,
		role: 'moderator',
		projectIds: [s.project],
	});
	await expect(s.admin.mutation(m('remove'), { membershipId: s.modId })).rejects.toThrow(
		'FORBIDDEN'
	);
	await s.owner.mutation(m('remove'), { membershipId: s.modId });
	await expect(s.moderator.query(q('get'), { organizationId: s.org })).rejects.toThrow('FORBIDDEN');
	await expect(s.moderator.mutation(m('increment'), { projectId: s.hidden })).rejects.toThrow(
		'FORBIDDEN'
	);
	expect(
		await s.t.run((ctx) =>
			ctx.db
				.query('assignments')
				.withIndex('by_membershipId_projectId', (q) => q.eq('membershipId', s.modId))
				.collect()
		)
	).toEqual([]);
});
test('owner cannot be removed/demoted; last owner cannot leave; moderator leave cleans assignments', async () => {
	const s = await setup();
	const ownerId = await s.t.run(
		async (ctx) =>
			(await ctx.db
				.query('memberships')
				.withIndex('by_organizationId_userId', (q) =>
					q.eq('organizationId', s.org).eq('userId', s.ids[0])
				)
				.unique())!._id
	);
	await expect(s.admin.mutation(m('remove'), { membershipId: ownerId })).rejects.toThrow(
		'OWNER_FROZEN'
	);
	await expect(
		s.admin.mutation(m('setRole'), { membershipId: ownerId, role: 'admin', projectIds: [] })
	).rejects.toThrow('OWNER_FROZEN');
	await expect(
		s.owner.mutation(m('setRole'), { membershipId: s.adminId, role: 'owner', projectIds: [] })
	).rejects.toThrow();
	await expect(s.owner.mutation(m('leave'), { organizationId: s.org })).rejects.toThrow(
		'LAST_OWNER'
	);
	await s.moderator.mutation(m('leave'), { organizationId: s.org });
	expect(await s.t.run((ctx) => ctx.db.query('assignments').collect())).toEqual([]);
	await expect(s.moderator.query(q('get'), { organizationId: s.org })).rejects.toThrow('FORBIDDEN');
});
