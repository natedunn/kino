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
	const data = await t.run(async (ctx) => {
		const owner = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const outsider = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const moderator = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const profile = await ctx.db.insert('profiles', {
			userId: owner,
			name: 'Owner',
			username: 'owner',
		});
		await ctx.db.patch('users', owner, { profileId: profile });
		const org = await ctx.db.insert('organizations', {
			name: 'Settings proof',
			slug: 'settings-proof',
			visibility: 'public',
		});
		await ctx.db.insert('memberships', { organizationId: org, userId: owner, role: 'owner' });
		const membership = await ctx.db.insert('memberships', {
			organizationId: org,
			userId: moderator,
			role: 'moderator',
		});
		const project = await ctx.db.insert('projects', {
			organizationId: org,
			name: 'Before',
			slug: 'before',
			visibility: 'public',
		});
		await ctx.db.insert('projectModeratorAssignments', {
			membershipId: membership,
			projectId: project,
		});
		const installation = await ctx.db.insert('relayInstallations', {
			orgId: org,
			orgSlug: 'settings-proof',
			connectedByProfileId: profile,
			installationId: 1,
			accountId: 1,
			accountLogin: 'test',
			accountType: 'User',
			events: [],
			permissions: {},
			repositorySelection: 'all',
			status: 'active',
			updatedTime: 1,
		});
		const connection = await ctx.db.insert('relayConnections', {
			orgId: org,
			orgSlug: 'settings-proof',
			projectId: project,
			projectSlug: 'before',
			connectedByProfileId: profile,
			githubInstallationId: installation,
			repoId: 1,
			repoNodeId: 'repo',
			repoName: 'example',
			repoFullName: 'owner/example',
			repoOwner: 'owner',
			repoPrivate: false,
			mode: 'read',
			enabledSources: ['issues'],
			verificationStatus: 'verified',
			verificationSummary: { issues: { ok: true }, discussions: { ok: false, enabled: false } },
			updatedTime: 1,
		});
		return { owner, outsider, moderator, org, project, installation, connection };
	});
	return {
		t,
		...data,
		ownerClient: t.withIdentity({ issuer, subject: data.owner }),
		moderatorClient: t.withIdentity({ issuer, subject: data.moderator }),
		outsiderClient: t.withIdentity({ issuer, subject: data.outsider }),
	};
}
const input = {
	name: 'After',
	slug: 'after',
	description: 'Saved description',
	visibility: 'private' as const,
	updatesFeaturedMode: 'manual' as const,
	urls: [
		{ source: 'github', text: 'Repo', url: 'https://github.com/owner/example' },
		{ source: 'github', text: 'Forged', url: 'https://example.com' },
	],
};

test('project rename preserves ID relations, moves Relay slugs, validates links and removes old/public access', async () => {
	const s = await fixture();
	await expect(
		s.outsiderClient.mutation(api.settings.updateProject, { id: s.project, ...input })
	).rejects.toThrow('FORBIDDEN');
	const saved = await s.ownerClient.mutation(api.settings.updateProject, {
		id: s.project,
		...input,
	});
	expect(saved.urls.map((u) => u.source)).toEqual(['github', 'manual']);
	expect(
		await s.ownerClient.query(api.projects.getBySlugs, {
			organizationSlug: 'settings-proof',
			projectSlug: 'before',
		})
	).toBeNull();
	expect(
		await s.t.query(api.projects.getBySlugs, {
			organizationSlug: 'settings-proof',
			projectSlug: 'after',
		})
	).toBeNull();
	expect(
		await s.ownerClient.query(api.projects.getBySlugs, {
			organizationSlug: 'settings-proof',
			projectSlug: 'after',
		})
	).toMatchObject({ project: { id: s.project, ...input, urls: saved.urls } });
	expect(await s.t.run((ctx) => ctx.db.get('relayConnections', s.connection))).toMatchObject({
		projectSlug: 'after',
		projectId: s.project,
	});
});

test('making an organization private atomically makes its public projects private', async () => {
	const s = await fixture();
	const route = { organizationSlug: 'settings-proof', projectSlug: 'before' };
	expect(await s.t.query(api.projects.getBySlugs, route)).not.toBeNull();
	await s.ownerClient.mutation(api.policy.setOrganizationVisibility, {
		organizationId: s.org,
		visibility: 'private',
	});
	expect((await s.t.run((ctx) => ctx.db.get('projects', s.project)))?.visibility).toBe('private');
	expect(await s.t.query(api.projects.getBySlugs, route)).toBeNull();
	expect(await s.outsiderClient.query(api.projects.getBySlugs, route)).toBeNull();
	expect(await s.moderatorClient.query(api.projects.getBySlugs, route)).not.toBeNull();
	await s.ownerClient.mutation(api.policy.setDirectProjectMember, {
		projectId: s.project,
		userId: s.outsider,
		enabled: true,
	});
	expect(await s.outsiderClient.query(api.projects.getBySlugs, route)).not.toBeNull();
	await s.ownerClient.mutation(api.policy.setDirectProjectMember, {
		projectId: s.project,
		userId: s.outsider,
		enabled: false,
	});
	expect(await s.outsiderClient.query(api.projects.getBySlugs, route)).toBeNull();
	await s.ownerClient.mutation(api.policy.setOrganizationVisibility, {
		organizationId: s.org,
		visibility: 'public',
	});
	expect(await s.t.query(api.projects.getBySlugs, route)).toBeNull();
	expect((await s.t.run((ctx) => ctx.db.get('projects', s.project)))?.visibility).toBe('private');
	await expect(
		s.ownerClient.mutation(api.policy.updateProject, {
			projectId: s.project,
			visibility: 'public',
		})
	).resolves.toBeNull();
	expect(await s.t.query(api.projects.getBySlugs, route)).not.toBeNull();
});

test('private organizations reject public project visibility on every native write path', async () => {
	const s = await fixture();
	await s.ownerClient.mutation(api.policy.setOrganizationVisibility, {
		organizationId: s.org,
		visibility: 'private',
	});
	await expect(
		s.ownerClient.mutation(api.settings.updateProject, {
			id: s.project,
			...input,
			slug: 'before',
			visibility: 'public',
		})
	).rejects.toThrow('PROJECT_PUBLIC_REQUIRES_PUBLIC_ORGANIZATION');
	await expect(
		s.ownerClient.mutation(api.policy.updateProject, {
			projectId: s.project,
			visibility: 'public',
		})
	).rejects.toThrow('PROJECT_PUBLIC_REQUIRES_PUBLIC_ORGANIZATION');
	await s.t.run((ctx) => ctx.db.patch('users', s.owner, { systemRole: 'system:admin' }));
	await expect(
		s.ownerClient.mutation(api.policy.createProjectForRoute, {
			orgSlug: 'settings-proof',
			name: 'New public',
			slug: 'new-public',
			visibility: 'public',
		})
	).rejects.toThrow('PROJECT_PUBLIC_REQUIRES_PUBLIC_ORGANIZATION');
	await expect(
		s.ownerClient.mutation(api.policy.createProjectForRoute, {
			orgSlug: 'settings-proof',
			name: 'New private',
			slug: 'new-private',
			visibility: 'private',
		})
	).resolves.toMatchObject({ slug: 'new-private' });
});

test('slug conflicts are atomic and archived project is frozen until manager unarchives', async () => {
	const s = await fixture();
	await s.t.run((ctx) =>
		ctx.db.insert('projects', {
			organizationId: s.org,
			name: 'Other',
			slug: 'after',
			visibility: 'private',
		})
	);
	await expect(
		s.ownerClient.mutation(api.settings.updateProject, { id: s.project, ...input })
	).rejects.toThrow('PROJECT_SLUG_TAKEN');
	expect(await s.t.run((ctx) => ctx.db.get('projects', s.project))).toMatchObject({
		slug: 'before',
		name: 'Before',
	});
	await expect(
		s.moderatorClient.mutation(api.settings.updateProject, {
			id: s.project,
			...input,
			slug: 'before',
			visibility: 'archived',
		})
	).rejects.toThrow('FORBIDDEN');
	await s.ownerClient.mutation(api.settings.updateProject, {
		id: s.project,
		...input,
		slug: 'before',
		visibility: 'archived',
	});
	await expect(
		s.moderatorClient.mutation(api.settings.updateProject, {
			id: s.project,
			...input,
			slug: 'before',
		})
	).rejects.toThrow('PROJECT_ARCHIVED');
	await s.ownerClient.mutation(api.settings.updateProject, {
		id: s.project,
		...input,
		slug: 'restored',
		visibility: 'public',
	});
	expect(
		await s.t.query(api.projects.getBySlugs, {
			organizationSlug: 'settings-proof',
			projectSlug: 'restored',
		})
	).not.toBeNull();
});

test('organization rename is manager-only, collision-safe, and updates live Relay views', async () => {
	const s = await fixture();
	await expect(
		s.moderatorClient.mutation(api.settings.updateOrganization, {
			currentSlug: 'settings-proof',
			name: 'Changed',
			updatedSlug: 'renamed-org',
		})
	).rejects.toThrow('FORBIDDEN');
	await s.ownerClient.mutation(api.settings.updateOrganization, {
		currentSlug: 'settings-proof',
		name: 'Changed',
		updatedSlug: 'renamed-org',
	});
	expect(
		await s.t.query(api.projects.getBySlugs, {
			organizationSlug: 'settings-proof',
			projectSlug: 'before',
		})
	).toBeNull();
	expect(
		await s.t.query(api.projects.getBySlugs, {
			organizationSlug: 'renamed-org',
			projectSlug: 'before',
		})
	).toMatchObject({ project: { id: s.project } });
	for (const row of await s.t.run(async (ctx) => [
		await ctx.db.get('relayConnections', s.connection),
		await ctx.db.get('relayInstallations', s.installation),
	]))
		expect(row).toMatchObject({ orgSlug: 'renamed-org' });
	await s.t.run((ctx) =>
		ctx.db.insert('organizations', { name: 'Conflict', slug: 'taken-org', visibility: 'public' })
	);
	await expect(
		s.ownerClient.mutation(api.settings.updateOrganization, {
			currentSlug: 'renamed-org',
			name: 'Bad',
			updatedSlug: 'taken-org',
		})
	).rejects.toThrow('ORGANIZATION_SLUG_TAKEN');
	expect(await s.t.run((ctx) => ctx.db.get('organizations', s.org))).toMatchObject({
		name: 'Changed',
		slug: 'renamed-org',
	});
});
