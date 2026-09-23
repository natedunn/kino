// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { expect, test } from 'vitest';

import schema from '../organizations/convex/schema';

const modules = import.meta.glob('../organizations/convex/**/*.{ts,js}');
const m = (name: string) => makeFunctionReference<'mutation'>(name);
const q = (name: string) => makeFunctionReference<'query'>(name);
async function setup() {
	const t = convexTest(schema, modules);
	const ids = await t.run(async (ctx) =>
		Promise.all(
			['owner', 'admin', 'moderator', 'direct', 'outsider', 'system', 'unverified'].map((name) =>
				ctx.db.insert('users', {
					verified: name !== 'unverified',
					email: name + '@example.test',
					...(name === 'system' ? { systemRole: 'system:admin' as const } : {}),
				})
			)
		)
	);
	const clients = ids.map((subject) => t.withIdentity({ subject }));
	const organizationId = await clients[0].mutation(m('organizations:create'), {
		name: 'Private org',
		slug: 'private',
	});
	const projectId = await clients[0].mutation(m('organizations:createProject'), {
		organizationId,
		name: 'Project',
	});
	const modId = await t.run(async (ctx) => {
		await ctx.db.insert('memberships', { organizationId, userId: ids[1], role: 'admin' });
		return ctx.db.insert('memberships', { organizationId, userId: ids[2], role: 'moderator' });
	});
	await clients[0].mutation(m('organizations:setRole'), {
		membershipId: modId,
		role: 'moderator',
		projectIds: [projectId],
	});
	await clients[0].mutation(m('policy:setProjectMember'), {
		projectId,
		userId: ids[3],
		enabled: true,
	});
	return { t, ids, clients: [...clients, t], organizationId, projectId, modId };
}
for (const visibility of ['public', 'private', 'archived'] as const) {
	test(`${visibility} project visibility matches owner/admin/moderator/direct/outsider/system/unverified/anonymous matrix`, async () => {
		const s = await setup();
		await s.clients[0].mutation(m('policy:updateProject'), { projectId: s.projectId, visibility });
		const expected =
			visibility === 'public'
				? [true, true, true, true, true, true, true, true]
				: visibility === 'private'
					? [true, true, true, true, false, true, false, false]
					: [true, true, true, false, false, true, false, false];
		for (const [i, client] of s.clients.entries()) {
			const result = await client.query(q('policy:viewProject'), { projectId: s.projectId });
			expect(result.permissions.canView).toBe(expected[i]);
			expect(!!result.project).toBe(expected[i]);
			expect(result.permissions.canManageContent).toBe([0, 1, 2, 5].includes(i));
			expect(result.permissions.canManageAccess).toBe([0, 1, 5].includes(i));
			expect(result.permissions.canManageIntegrations).toBe([0, 1, 5].includes(i));
			if (visibility === 'archived' || ![0, 1, 2, 5].includes(i))
				await expect(
					client.mutation(m('organizations:increment'), { projectId: s.projectId })
				).rejects.toThrow();
			else await client.mutation(m('organizations:increment'), { projectId: s.projectId });
		}
	});
}
test('public organization does not expose private project; direct project membership does not grant org management', async () => {
	const s = await setup();
	expect(
		(await s.clients[3].query(q('policy:viewOrganization'), { organizationId: s.organizationId }))
			.organization
	).toBeNull();
	await s.clients[0].mutation(m('policy:setOrganizationVisibility'), {
		organizationId: s.organizationId,
		visibility: 'public',
	});
	expect(
		(await s.t.query(q('policy:viewOrganization'), { organizationId: s.organizationId }))
			.permissions
	).toMatchObject({ canView: true, canEdit: false });
	expect((await s.t.query(q('policy:viewProject'), { projectId: s.projectId })).project).toBeNull();
	await expect(
		s.clients[3].mutation(m('policy:setOrganizationVisibility'), {
			organizationId: s.organizationId,
			visibility: 'private',
		})
	).rejects.toThrow('FORBIDDEN');
});
test('system admin comes from stored user data, not forged identity claims; revocation applies to same identity', async () => {
	const s = await setup();
	const forged = s.t.withIdentity({ subject: s.ids[4], role: 'system:admin' });
	expect(
		(await forged.query(q('policy:viewOrganization'), { organizationId: s.organizationId }))
			.organization
	).toBeNull();
	await expect(
		forged.mutation(m('policy:updateProject'), { projectId: s.projectId, name: 'Bad' })
	).rejects.toThrow('FORBIDDEN');
	await s.clients[5].mutation(m('policy:updateProject'), {
		projectId: s.projectId,
		name: 'Allowed',
	});
	expect(
		(await s.clients[5].query(q('policy:viewOrganization'), { organizationId: s.organizationId }))
			.permissions.canEdit
	).toBe(true);
	await s.t.run((ctx) => ctx.db.patch(s.ids[5], { systemRole: undefined }));
	await expect(
		s.clients[5].mutation(m('policy:updateProject'), { projectId: s.projectId, name: 'Revoked' })
	).rejects.toThrow('FORBIDDEN');
});
test('moderator edits normal settings but cannot archive, unarchive, grant access or delete', async () => {
	const s = await setup();
	const mod = s.clients[2];
	await mod.mutation(m('policy:updateProject'), { projectId: s.projectId, name: 'Moderator edit' });
	await expect(
		mod.mutation(m('policy:updateProject'), { projectId: s.projectId, visibility: 'archived' })
	).rejects.toThrow('FORBIDDEN');
	await expect(
		mod.mutation(m('policy:setProjectMember'), {
			projectId: s.projectId,
			userId: s.ids[4],
			enabled: true,
		})
	).rejects.toThrow('FORBIDDEN');
	await expect(mod.mutation(m('policy:removeProject'), { projectId: s.projectId })).rejects.toThrow(
		'FORBIDDEN'
	);
	await s.clients[0].mutation(m('policy:updateProject'), {
		projectId: s.projectId,
		visibility: 'archived',
	});
	await expect(
		mod.mutation(m('policy:updateProject'), { projectId: s.projectId, visibility: 'private' })
	).rejects.toThrow('PROJECT_ARCHIVED');
	for (const client of [s.clients[0], s.clients[5]]) {
		await expect(
			client.mutation(m('policy:updateProject'), { projectId: s.projectId, name: 'Frozen' })
		).rejects.toThrow('PROJECT_ARCHIVED');
		await expect(
			client.mutation(m('policy:setProjectMember'), {
				projectId: s.projectId,
				userId: s.ids[4],
				enabled: true,
			})
		).rejects.toThrow('PROJECT_ARCHIVED');
	}
	await s.clients[5].mutation(m('policy:updateProject'), {
		projectId: s.projectId,
		visibility: 'private',
		name: 'Unarchived',
	});
	await mod.mutation(m('organizations:increment'), { projectId: s.projectId });
});
test('archived deletion allowed to manager and cleans assignment/direct-member references', async () => {
	const s = await setup();
	await s.clients[0].mutation(m('policy:updateProject'), {
		projectId: s.projectId,
		visibility: 'archived',
	});
	await s.clients[5].mutation(m('policy:removeProject'), { projectId: s.projectId });
	expect(
		(await s.clients[0].query(q('policy:viewProject'), { projectId: s.projectId })).project
	).toBeNull();
	expect(await s.t.run((ctx) => ctx.db.query('assignments').collect())).toEqual([]);
	expect(await s.t.run((ctx) => ctx.db.query('projectMembers').collect())).toEqual([]);
});
test('direct membership revoke and missing parent immediately hide private project', async () => {
	const s = await setup();
	await s.clients[0].mutation(m('policy:setProjectMember'), {
		projectId: s.projectId,
		userId: s.ids[3],
		enabled: false,
	});
	expect(
		(await s.clients[3].query(q('policy:viewProject'), { projectId: s.projectId })).project
	).toBeNull();
	await s.t.run((ctx) => ctx.db.delete(s.organizationId));
	expect(
		(await s.clients[5].query(q('policy:viewProject'), { projectId: s.projectId })).project
	).toBeNull();
});
