// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { beforeEach, expect, test } from 'vitest';

import { configureTestAuth, issuer } from '../testing/setup.testing';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.testing.ts']);
beforeEach(configureTestAuth);
async function fixture() {
	const t = convexTest(schema, modules);
	const ids = await t.run(async (ctx) => {
		const owner = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const member = await ctx.db.insert('users', {
			status: 'active',
			systemRole: 'user',
			githubEmail: 'member@example.com',
			githubEmailVerifiedAt: 1,
		});
		const moderator = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		for (const [userId, username] of [
			[owner, 'owner'],
			[member, 'member'],
			[moderator, 'moderator'],
		] as const)
			await ctx.db.insert('profiles', { userId, name: username, username });
		const organizationId = await ctx.db.insert('organizations', {
			name: 'Org',
			slug: 'org',
			visibility: 'public',
		});
		const foreignOrg = await ctx.db.insert('organizations', {
			name: 'Other',
			slug: 'other',
			visibility: 'public',
		});
		await ctx.db.insert('memberships', { organizationId, userId: owner, role: 'owner' });
		const moderatorMembership = await ctx.db.insert('memberships', {
			organizationId,
			userId: moderator,
			role: 'moderator',
		});
		const foreignMembership = await ctx.db.insert('memberships', {
			organizationId: foreignOrg,
			userId: moderator,
			role: 'moderator',
		});
		const projectId = await ctx.db.insert('projects', {
			organizationId,
			name: 'Project',
			slug: 'project',
			visibility: 'private',
		});
		return { owner, member, moderator, projectId, moderatorMembership, foreignMembership };
	});
	return {
		t,
		...ids,
		ownerClient: t.withIdentity({ issuer, subject: ids.owner }),
		memberClient: t.withIdentity({ issuer, subject: ids.member }),
		moderatorClient: t.withIdentity({ issuer, subject: ids.moderator }),
	};
}

test('only managers can find and add an existing verified account; direct access is revoked on removal', async () => {
	const s = await fixture();
	const args = { projectId: s.projectId, email: ' MEMBER@EXAMPLE.COM ' };
	await expect(
		s.memberClient.mutation(api.projectMembers.inviteProjectMember, args)
	).rejects.toThrow('FORBIDDEN');
	await expect(s.t.mutation(api.projectMembers.inviteProjectMember, args)).rejects.toThrow(
		'UNAUTHORIZED'
	);
	await s.ownerClient.mutation(api.projectMembers.inviteProjectMember, args);
	expect(
		await s.memberClient.query(api.policy.viewProject, { projectId: s.projectId })
	).toMatchObject({ permissions: { canView: true, canManageAccess: false } });
	await expect(
		s.memberClient.query(api.projectMembers.listProjectMembers, { projectId: s.projectId })
	).rejects.toThrow('FORBIDDEN');
	const state = await s.ownerClient.query(api.projectMembers.listProjectMembers, {
		projectId: s.projectId,
	});
	expect(state.members).toHaveLength(1);
	await expect(
		s.ownerClient.mutation(api.projectMembers.inviteProjectMember, args)
	).rejects.toThrow('PROJECT_MEMBER_ALREADY_HAS_ACCESS');
	await s.ownerClient.mutation(api.projectMembers.removeProjectMember, {
		projectMemberId: state.members[0].id,
	});
	expect(
		await s.memberClient.query(api.policy.viewProject, { projectId: s.projectId })
	).toMatchObject({ permissions: { canView: false } });
});

test('moderator assignment is project-scoped and cannot be self-granted or applied across organizations', async () => {
	const s = await fixture();
	const args = { projectId: s.projectId, memberId: s.moderatorMembership, enabled: true };
	await expect(
		s.moderatorClient.mutation(api.projectMembers.setModeratorAccess, args)
	).rejects.toThrow('FORBIDDEN');
	await expect(
		s.ownerClient.mutation(api.projectMembers.setModeratorAccess, {
			...args,
			memberId: s.foreignMembership,
		})
	).rejects.toThrow('FORBIDDEN');
	await s.ownerClient.mutation(api.projectMembers.setModeratorAccess, args);
	await s.ownerClient.mutation(api.projectMembers.setModeratorAccess, args);
	expect(
		await s.ownerClient.query(api.projectMembers.getManagementState, { projectId: s.projectId })
	).toMatchObject({ moderators: [{ assigned: true, memberId: s.moderatorMembership }] });
	await expect(
		s.moderatorClient.mutation(api.projectMembers.inviteProjectMember, {
			projectId: s.projectId,
			email: 'member@example.com',
		})
	).rejects.toThrow('FORBIDDEN');
	await s.ownerClient.mutation(api.projectMembers.setModeratorAccess, { ...args, enabled: false });
	expect(
		await s.moderatorClient.query(api.policy.viewProject, { projectId: s.projectId })
	).toMatchObject({ permissions: { canView: false } });
});

test('archived projects freeze all membership writes while managers retain read access', async () => {
	const s = await fixture();
	await s.ownerClient.mutation(api.projectMembers.inviteProjectMember, {
		projectId: s.projectId,
		email: 'member@example.com',
	});
	await s.t.run((ctx) => ctx.db.patch('projects', s.projectId, { visibility: 'archived' }));
	const state = await s.ownerClient.query(api.projectMembers.listProjectMembers, {
		projectId: s.projectId,
	});
	await expect(
		s.ownerClient.mutation(api.projectMembers.removeProjectMember, {
			projectMemberId: state.members[0].id,
		})
	).rejects.toThrow('PROJECT_ARCHIVED');
	await expect(
		s.ownerClient.mutation(api.projectMembers.inviteProjectMember, {
			projectId: s.projectId,
			email: 'member@example.com',
		})
	).rejects.toThrow('PROJECT_ARCHIVED');
	await expect(
		s.ownerClient.mutation(api.projectMembers.setModeratorAccess, {
			projectId: s.projectId,
			memberId: s.moderatorMembership,
			enabled: true,
		})
	).rejects.toThrow('PROJECT_ARCHIVED');
});

test('unverified, disabled and ambiguous email identities are never granted access', async () => {
	const s = await fixture();
	await s.t.run(async (ctx) => {
		await ctx.db.insert('users', {
			status: 'active',
			systemRole: 'user',
			passwordEmail: 'member@example.com',
			passwordEmailVerifiedAt: 1,
		});
		await ctx.db.insert('users', {
			status: 'active',
			systemRole: 'user',
			passwordEmail: 'unverified@example.com',
		});
		await ctx.db.insert('users', {
			status: 'disabled',
			systemRole: 'user',
			passwordEmail: 'disabled@example.com',
			passwordEmailVerifiedAt: 1,
		});
	});
	for (const email of ['member@example.com', 'unverified@example.com', 'disabled@example.com'])
		await expect(
			s.ownerClient.mutation(api.projectMembers.inviteProjectMember, {
				projectId: s.projectId,
				email,
			})
		).rejects.toThrow('ACCOUNT_NOT_FOUND_FOR_EMAIL');
	expect(
		(await s.ownerClient.query(api.projectMembers.listProjectMembers, { projectId: s.projectId }))
			.members
	).toEqual([]);
});

test('removing a direct membership never removes inherited organization or moderator access', async () => {
	const s = await fixture();
	await s.t.run(async (ctx) => {
		await ctx.db.patch('users', s.owner, {
			passwordEmail: 'owner@example.com',
			passwordEmailVerifiedAt: 1,
		});
		await ctx.db.patch('users', s.moderator, {
			passwordEmail: 'mod@example.com',
			passwordEmailVerifiedAt: 1,
		});
	});
	await s.ownerClient.mutation(api.projectMembers.setModeratorAccess, {
		projectId: s.projectId,
		memberId: s.moderatorMembership,
		enabled: true,
	});
	for (const email of ['owner@example.com', 'mod@example.com'])
		await s.ownerClient.mutation(api.projectMembers.inviteProjectMember, {
			projectId: s.projectId,
			email,
		});
	for (const member of (
		await s.ownerClient.query(api.projectMembers.listProjectMembers, { projectId: s.projectId })
	).members)
		await s.ownerClient.mutation(api.projectMembers.removeProjectMember, {
			projectMemberId: member.id,
		});
	expect(
		await s.ownerClient.query(api.policy.viewProject, { projectId: s.projectId })
	).toMatchObject({ permissions: { canManageAccess: true } });
	expect(
		await s.moderatorClient.query(api.policy.viewProject, { projectId: s.projectId })
	).toMatchObject({ permissions: { canManageContent: true, canManageAccess: false } });
});

test('project assignment mutation cannot bypass the organization assignment limit', async () => {
	const s = await fixture();
	await s.t.run(async (ctx) => {
		const project = await ctx.db.get('projects', s.projectId);
		for (let i = 0; i < 200; i++) {
			const projectId = await ctx.db.insert('projects', {
				organizationId: project!.organizationId,
				name: `Project ${i}`,
				slug: `project-${i}`,
				visibility: 'private',
			});
			await ctx.db.insert('projectModeratorAssignments', {
				membershipId: s.moderatorMembership,
				projectId,
			});
		}
	});
	await expect(
		s.ownerClient.mutation(api.projectMembers.setModeratorAccess, {
			projectId: s.projectId,
			memberId: s.moderatorMembership,
			enabled: true,
		})
	).rejects.toThrow('ASSIGNMENT_LIMIT');
	expect(
		await s.ownerClient.query(api.projectMembers.getManagementState, { projectId: s.projectId })
	).toMatchObject({ moderators: [{ assigned: false }] });
});
