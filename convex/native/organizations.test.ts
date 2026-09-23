// @vitest-environment edge-runtime
import type { Id } from './_generated/dataModel';

import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { configureTestAuth, issuer } from '../testing/setup.testing';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.testing.ts']);

beforeEach(async () => {
	await configureTestAuth();
	for (const key of ['BENTO_PUBLISHABLE_KEY', 'BENTO_SECRET_KEY', 'BENTO_SITE_UUID', 'BENTO_FROM'])
		vi.stubEnv(key, 'test-only');
});

afterEach(() => vi.unstubAllEnvs());

function setup() {
	const t = convexTest(schema, modules);
	registerRateLimiter(t, 'authLimits');
	return t;
}

type Backend = ReturnType<typeof setup>;

async function createUser(t: Backend, label: string) {
	const email = `${label}@example.test`;
	const userId = await t.run(async (ctx) => {
		const id = await ctx.db.insert('users', {
			status: 'active',
			systemRole: 'user',
			passwordEmail: email,
			passwordEmailVerifiedAt: Date.now(),
		});
		const profileId = await ctx.db.insert('profiles', {
			userId: id,
			name: label,
			username: label,
		});
		await ctx.db.patch('users', id, { profileId });
		return id;
	});
	return { email, userId, caller: t.withIdentity({ issuer, subject: userId }) };
}

async function fixture() {
	const t = setup();
	const owner = await createUser(t, 'owner');
	const admin = await createUser(t, 'admin');
	const moderator = await createUser(t, 'moderator');
	const outsider = await createUser(t, 'outsider');
	const organizationId = await owner.caller.mutation(api.organizations.create, {
		name: 'Acme',
		slug: 'acme',
	});
	const projectId = await owner.caller.mutation(api.policy.createProject, {
		organizationId,
		name: 'Private project',
		slug: 'private-project',
	});
	return { t, owner, admin, moderator, outsider, organizationId, projectId };
}

async function invite(
	s: Awaited<ReturnType<typeof fixture>>,
	recipient: { email: string; caller: ReturnType<Backend['withIdentity']> },
	role: 'admin' | 'moderator',
	projectIds: Array<Id<'projects'>>
) {
	const invitationId = await s.owner.caller.mutation(api.invitations.create, {
		organizationId: s.organizationId,
		email: recipient.email,
		role,
		projectIds,
	});
	const accepted = await recipient.caller.mutation(api.invitations.accept, { invitationId });
	return { invitationId, membershipId: accepted.membershipId };
}

describe('native organization authorization', () => {
	test('enforces the existing project limit in both the form permission and writes', async () => {
		const s = await fixture();
		expect(
			await s.owner.caller.query(api.policy.getMyProjectCreationPermission, { orgSlug: 'acme' })
		).toEqual({ canAddProjects: false });
		expect(
			await s.outsider.caller.query(api.policy.getMyProjectCreationPermission, { orgSlug: 'acme' })
		).toEqual({ canAddProjects: false });
		await expect(
			s.owner.caller.mutation(api.policy.createProjectForRoute, {
				name: 'Over limit',
				orgSlug: 'acme',
				slug: 'over-limit',
				visibility: 'private',
			})
		).rejects.toThrow('PROJECT_LIMIT_REACHED');
		await s.t.run((ctx) => ctx.db.patch('users', s.owner.userId, { systemRole: 'system:admin' }));
		expect(
			await s.owner.caller.query(api.policy.getMyProjectCreationPermission, { orgSlug: 'acme' })
		).toEqual({ canAddProjects: true });
		await s.owner.caller.mutation(api.policy.createProjectForRoute, {
			name: 'Admin project',
			orgSlug: 'acme',
			slug: 'admin-project',
			visibility: 'private',
		});
	});
	test('the automatic personal organization does not use the free team slot', async () => {
		const t = setup();
		const creator = await createUser(t, 'creator');
		await t.run(async (ctx) => {
			const personalOrganizationId = await ctx.db.insert('organizations', {
				name: 'Personal',
				slug: 'personal',
				visibility: 'public',
				personalOwnerId: creator.userId,
			});
			await ctx.db.insert('memberships', {
				organizationId: personalOrganizationId,
				userId: creator.userId,
				role: 'owner',
			});
			await ctx.db.patch('users', creator.userId, { personalOrganizationId });
		});
		expect(await creator.caller.query(api.organizations.listMineForRoute, {})).toMatchObject({
			underLimit: true,
		});
		await creator.caller.mutation(api.organizations.createForRoute, {
			name: 'Team',
			visibility: 'public',
		});
		expect(await creator.caller.query(api.organizations.listMineForRoute, {})).toMatchObject({
			underLimit: false,
		});
	});

	test('preserves the full creation forms visibility and generated organization slug', async () => {
		const s = await fixture();
		const creator = await createUser(s.t, 'creator');
		const generated = await creator.caller.mutation(api.organizations.createForRoute, {
			name: 'Native Creation Team',
			visibility: 'private',
		});
		expect(generated.slug).toBe('native-creation-team');
		expect(
			await creator.caller.query(api.organizations.getBySlug, { slug: generated.slug })
		).toMatchObject({
			id: generated.id,
			visibility: 'private',
		});

		await expect(
			creator.caller.mutation(api.policy.createProjectForRoute, {
				name: 'Public project',
				orgSlug: generated.slug,
				slug: 'public-project',
				visibility: 'public',
			})
		).rejects.toThrow('PROJECT_PUBLIC_REQUIRES_PUBLIC_ORGANIZATION');
		const project = await creator.caller.mutation(api.policy.createProjectForRoute, {
			name: 'Private project',
			orgSlug: generated.slug,
			slug: 'private-project',
			visibility: 'private',
		});
		const storedProject = await s.t.run((ctx) => ctx.db.get('projects', project.id));
		expect(storedProject).toMatchObject({ slug: 'private-project', visibility: 'private' });
		await expect(
			s.outsider.caller.mutation(api.policy.createProjectForRoute, {
				name: 'Forbidden',
				orgSlug: generated.slug,
				slug: 'forbidden',
				visibility: 'private',
			})
		).rejects.toThrow('FORBIDDEN');
		expect(await creator.caller.query(api.organizations.listMineForRoute, {})).toMatchObject({
			underLimit: false,
			teams: [expect.objectContaining({ id: generated.id })],
		});
		await expect(
			creator.caller.mutation(api.organizations.createForRoute, {
				name: 'Over limit',
				visibility: 'public',
			})
		).rejects.toThrow('ORGANIZATION_LIMIT_REACHED');
		await s.t.run((ctx) => ctx.db.patch('users', creator.userId, { systemRole: 'system:admin' }));
		expect(await creator.caller.query(api.organizations.listMineForRoute, {})).toMatchObject({
			underLimit: true,
		});
		await creator.caller.mutation(api.organizations.createForRoute, {
			name: 'Admin team',
			visibility: 'public',
		});
	});

	test('creates organizations transactionally and scopes the live switcher to memberships', async () => {
		const s = await fixture();
		expect(await s.owner.caller.query(api.organizations.listMine, {})).toEqual([
			expect.objectContaining({
				id: s.organizationId,
				role: 'owner',
				slug: 'acme',
				canManage: true,
			}),
		]);
		expect(await s.outsider.caller.query(api.organizations.listMine, {})).toEqual([]);
		await expect(
			s.outsider.caller.query(api.organizations.listMembers, {
				organizationId: s.organizationId,
			})
		).rejects.toThrow('FORBIDDEN');
		await expect(
			s.outsider.caller.mutation(api.organizations.create, { name: 'Duplicate', slug: 'acme' })
		).rejects.toThrow('ORGANIZATION_SLUG_TAKEN');
	});

	test('accepts only the verified recipient and cannot replay a removed membership', async () => {
		const s = await fixture();
		const invitationId = await s.owner.caller.mutation(api.invitations.create, {
			organizationId: s.organizationId,
			email: ` ${s.admin.email.toUpperCase()} `,
			role: 'admin',
			projectIds: [],
		});
		expect(
			await s.admin.caller.query(api.invitations.inspect, { invitationId, now: Date.now() })
		).toMatchObject({
			state: 'pending',
			organizationSlug: 'acme',
		});
		expect(
			await s.outsider.caller.query(api.invitations.inspect, { invitationId, now: Date.now() })
		).toEqual({
			state: 'wrong_account',
		});
		await expect(
			s.outsider.caller.mutation(api.invitations.accept, { invitationId })
		).rejects.toThrow('WRONG_RECIPIENT');
		const first = await s.admin.caller.mutation(api.invitations.accept, { invitationId });
		expect(await s.admin.caller.mutation(api.invitations.accept, { invitationId })).toEqual(first);
		await s.owner.caller.mutation(api.organizations.removeMember, {
			membershipId: first.membershipId,
		});
		await expect(s.admin.caller.mutation(api.invitations.accept, { invitationId })).rejects.toThrow(
			'INVITATION_UNAVAILABLE'
		);
		expect(await s.admin.caller.query(api.organizations.listMine, {})).toEqual([]);
	});

	test('applies the central role matrix and revokes moderator access immediately', async () => {
		const s = await fixture();
		const admin = await invite(s, s.admin, 'admin', []);
		const moderator = await invite(s, s.moderator, 'moderator', [s.projectId]);
		expect(
			await s.moderator.caller.query(api.policy.viewProject, { projectId: s.projectId })
		).toMatchObject({
			permissions: {
				canView: true,
				canManageContent: true,
				canEditSettings: true,
				canManageAccess: false,
				canManageIntegrations: false,
				canDelete: false,
			},
		});
		await s.moderator.caller.mutation(api.policy.assertContentWrite, {
			projectId: s.projectId,
		});
		await expect(
			s.moderator.caller.mutation(api.organizations.removeMember, {
				membershipId: admin.membershipId,
			})
		).rejects.toThrow('FORBIDDEN');
		await s.owner.caller.mutation(api.organizations.removeMember, {
			membershipId: moderator.membershipId,
		});
		await expect(
			s.moderator.caller.mutation(api.policy.assertContentWrite, {
				projectId: s.projectId,
			})
		).rejects.toThrow('FORBIDDEN');
		const ownerMembershipId = await s.t.run(async (ctx) => {
			const owner = await ctx.db
				.query('memberships')
				.withIndex('by_organizationId_and_userId', (q) =>
					q.eq('organizationId', s.organizationId).eq('userId', s.owner.userId)
				)
				.unique();
			return owner!._id;
		});
		await expect(
			s.admin.caller.mutation(api.organizations.removeMember, {
				membershipId: ownerMembershipId,
			})
		).rejects.toThrow('OWNER_FROZEN');
	});
});
