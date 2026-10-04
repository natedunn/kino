// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { configureTestAuth, issuer } from '../testing/setup.testing';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.testing.ts']);
beforeEach(configureTestAuth);
afterEach(() => vi.unstubAllEnvs());

async function fixture(provider: 'github' | 'password' = 'github', verified = true) {
	const t = convexTest(schema, modules);
	const ids = await t.run(async (ctx) => {
		const userId = await ctx.db.insert('users', {
			status: 'active',
			systemRole: 'user',
			...(provider === 'github'
				? { githubEmail: 'admin@example.test', ...(verified ? { githubEmailVerifiedAt: 1 } : {}) }
				: {
						passwordEmail: 'admin@example.test',
						...(verified ? { passwordEmailVerifiedAt: 1 } : {}),
					}),
		});
		const profileId = await ctx.db.insert('profiles', {
			userId,
			name: 'Admin',
			username: 'testadmin',
		});
		await ctx.db.patch('users', userId, { profileId });
		const organizationId = await ctx.db.insert('organizations', {
			name: 'Team',
			slug: 'test-team',
			visibility: 'public',
		});
		await ctx.db.insert('memberships', { organizationId, userId, role: 'owner' });
		return { userId, organizationId };
	});
	return { t, ...ids, caller: t.withIdentity({ issuer, subject: ids.userId }) };
}

const create = { orgSlug: 'test-team', name: 'Kino', slug: 'kino', visibility: 'public' as const };

test.each(['github', 'password'] as const)(
	'verified %s admin email can create and rename reserved project slugs',
	async (provider) => {
		vi.stubEnv('SUPER_ADMIN_EMAIL', ' ADMIN@EXAMPLE.TEST ');
		const s = await fixture(provider);
		expect(await s.caller.query(api.profiles.me, {})).toMatchObject({
			canUseReservedProjectSlugs: true,
			systemRole: 'user',
		});
		const project = await s.caller.mutation(api.policy.createProjectForRoute, create);
		expect(project.slug).toBe('kino');
		const update = {
			id: project.id,
			name: 'Kino',
			slug: 'feedback',
			description: '',
			visibility: 'public' as const,
			updatesFeaturedMode: 'latest' as const,
			urls: [],
		};
		expect(await s.caller.mutation(api.settings.updateProject, update)).toMatchObject({
			slug: 'feedback',
		});
		await expect(
			s.caller.mutation(api.settings.updateProject, { ...update, slug: 'bad--slug' })
		).rejects.toThrow('INVALID_ARGUMENT');
		vi.stubEnv('SUPER_ADMIN_EMAIL', 'other@example.test');
		await expect(s.caller.mutation(api.settings.updateProject, update)).rejects.toThrow(
			'INVALID_ARGUMENT'
		);
	}
);

test.each(['missing', 'blank', 'different', 'unverified', 'spoofed'] as const)(
	'rejects reserved project creation for %s admin evidence on both entry points',
	async (evidence) => {
		vi.stubEnv(
			'SUPER_ADMIN_EMAIL',
			evidence === 'missing'
				? undefined
				: evidence === 'blank'
					? ' '
					: evidence === 'different' || evidence === 'spoofed'
						? 'other@example.test'
						: 'admin@example.test'
		);
		const s = await fixture('github', evidence !== 'unverified');
		const caller =
			evidence === 'spoofed'
				? s.t.withIdentity({ issuer, subject: s.userId, email: 'other@example.test' })
				: s.caller;
		await expect(caller.mutation(api.policy.createProjectForRoute, create)).rejects.toThrow(
			'INVALID_PROJECT'
		);
		await expect(
			caller.mutation(api.policy.createProject, {
				organizationId: s.organizationId,
				name: create.name,
				slug: create.slug,
			})
		).rejects.toThrow('INVALID_PROJECT');
		expect(await s.t.run((ctx) => ctx.db.query('projects').collect())).toEqual([]);
	}
);

test('admin email exception keeps organization permissions, slug uniqueness and project limits', async () => {
	vi.stubEnv('SUPER_ADMIN_EMAIL', 'admin@example.test');
	const s = await fixture();
	const otherOrg = await s.t.run((ctx) =>
		ctx.db.insert('organizations', { name: 'Other', slug: 'other-team', visibility: 'public' })
	);
	await expect(
		s.caller.mutation(api.policy.createProject, {
			organizationId: otherOrg,
			name: 'Kino',
			slug: 'kino',
		})
	).rejects.toThrow('FORBIDDEN');
	await s.caller.mutation(api.policy.createProjectForRoute, create);
	await expect(
		s.caller.mutation(api.policy.createProjectForRoute, { ...create, slug: 'another' })
	).rejects.toThrow('PROJECT_LIMIT_REACHED');
	await s.t.run((ctx) => ctx.db.patch('users', s.userId, { systemRole: 'system:admin' }));
	await expect(s.caller.mutation(api.policy.createProjectForRoute, create)).rejects.toThrow(
		'PROJECT_SLUG_TAKEN'
	);
});
