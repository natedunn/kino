// @vitest-environment edge-runtime
import type { GithubProfile } from '@convex-dev/auth/providers/oauth/github';

import { registerCore } from '@convex-dev/auth/providers/testing/core';
import { convexTest } from 'convex-test';
import { createFunctionHandle } from 'convex/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { configureTestAuth, issuer } from '../testing/setup.testing';
import { api, components, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.testing.ts']);

const profile: GithubProfile = {
	id: '1234',
	login: 'nate',
	name: 'Nate',
	email: 'nate@example.test',
	emailVerified: true,
};

beforeEach(configureTestAuth);
afterEach(() => vi.unstubAllEnvs());

function setup() {
	const t = convexTest(schema, modules);
	registerCore(t);
	return t;
}
type Backend = ReturnType<typeof setup>;

function signUp(t: Backend, input = profile) {
	return t.run(async (ctx) =>
		ctx.runMutation(components.auth.public.signUp, {
			claims: { providerName: 'github', providerAccountId: input.id, profile: input },
			createUserHandle: await createFunctionHandle(internal.github.createUser),
			onSignInHandle: await createFunctionHandle(internal.github.onSignIn),
			issuer,
		})
	);
}
function signIn(t: Backend, input = profile) {
	return t.run(async (ctx) =>
		ctx.runMutation(components.auth.public.signIn, {
			claims: { providerName: 'github', providerAccountId: input.id, profile: input },
			onSignInHandle: await createFunctionHandle(internal.github.onSignIn),
			issuer,
		})
	);
}

describe('native identity and profile bootstrap', () => {
	test('creates the app user, profile, provider account and session together', async () => {
		const t = setup();
		const tokens = await signUp(t);
		const caller = t.withIdentity({ issuer, subject: tokens.userId });
		expect(await caller.query(api.auth.isAuthenticated, {})).toBe(true);
		expect(await caller.query(api.profiles.me, {})).toMatchObject({
			id: tokens.userId,
			name: 'Nate',
			username: 'nate',
			email: profile.email,
			systemRole: 'user',
		});
		expect(
			await t.run((ctx) =>
				ctx.runQuery(components.auth.public.getUserIdByAccount, {
					provider: 'github',
					providerAccountId: '1234',
				})
			)
		).toBe(tokens.userId);
	});

	test('repeat login preserves app profile edits and refreshes verified email', async () => {
		const t = setup();
		const first = await signUp(t);
		await t.run(async (ctx) => {
			const row = await ctx.db.query('profiles').unique();
			await ctx.db.patch('profiles', row!._id, { name: 'Edited name', username: 'edited' });
		});
		const second = await signIn(t, {
			...profile,
			login: 'renamed-on-github',
			email: 'new@example.test',
		});
		expect(second.userId).toBe(first.userId);
		expect(
			await t.withIdentity({ issuer, subject: second.userId }).query(api.profiles.me, {})
		).toMatchObject({ name: 'Edited name', username: 'edited', email: 'new@example.test' });
		expect(await t.run((ctx) => ctx.db.query('profiles').collect())).toHaveLength(1);
	});

	test('same email never links a GitHub identity to a password user or another GitHub account', async () => {
		const t = setup();
		const passwordUser = await t.run((ctx) =>
			ctx.db.insert('users', {
				status: 'active',
				systemRole: 'user',
				passwordEmail: profile.email,
				passwordEmailVerifiedAt: Date.now(),
			})
		);
		const first = await signUp(t);
		const other = await signUp(t, { ...profile, id: '5678' });
		expect(new Set([passwordUser, first.userId, other.userId]).size).toBe(3);
		const rows = await t.run((ctx) => ctx.db.query('profiles').collect());
		expect(new Set(rows.map((row) => row.username)).size).toBe(2);
	});

	test('unverified email rolls the user/account/profile creation back', async () => {
		const t = setup();
		await expect(signUp(t, { ...profile, emailVerified: false })).rejects.toThrow(
			'VERIFIED_EMAIL_REQUIRED'
		);
		expect(await t.run((ctx) => ctx.db.query('users').collect())).toEqual([]);
		expect(await t.run((ctx) => ctx.db.query('profiles').collect())).toEqual([]);
		expect(
			await t.run((ctx) =>
				ctx.runQuery(components.auth.public.getUserIdByAccount, {
					provider: 'github',
					providerAccountId: '1234',
				})
			)
		).toBeNull();
	});

	test('refuses mismatched provider account evidence', async () => {
		const t = setup();
		await expect(
			t.mutation(internal.github.createUser, {
				provider: { name: 'github', accountId: 'other', profile },
			})
		).rejects.toThrow('GITHUB_ACCOUNT_MISMATCH');
		const tokens = await signUp(t);
		await expect(
			t.run(async (ctx) => {
				const user = await ctx.db.query('users').unique();
				return ctx.runMutation(internal.github.onSignIn, {
					userId: user!._id,
					provider: { name: 'github', accountId: '5678', profile: { ...profile, id: '5678' } },
				});
			})
		).rejects.toThrow('GITHUB_ACCOUNT_MISMATCH');
		expect(
			await t.withIdentity({ issuer, subject: tokens.userId }).query(api.auth.isAuthenticated, {})
		).toBe(true);
	});

	test('refuses anonymous, wrong issuer, malformed subject, pending, missing and disabled users', async () => {
		const t = setup();
		const tokens = await signUp(t);
		for (const caller of [
			t,
			t.withIdentity({ issuer: 'https://other.convex.site', subject: tokens.userId }),
			t.withIdentity({ issuer, subject: 'not-a-document-id' }),
		]) {
			expect(await caller.query(api.auth.isAuthenticated, {})).toBe(false);
			expect(await caller.query(api.profiles.me, {})).toBeNull();
		}
		const caller = t.withIdentity({ issuer, subject: tokens.userId });
		for (const status of ['pendingVerification', 'disabled'] as const) {
			await t.run(async (ctx) => {
				const user = await ctx.db.query('users').unique();
				await ctx.db.patch('users', user!._id, { status });
			});
			expect(await caller.query(api.auth.isAuthenticated, {})).toBe(false);
			expect(await caller.query(api.profiles.me, {})).toBeNull();
			await expect(signIn(t)).rejects.toThrow('SIGN_IN_REJECTED');
		}
		await t.run(async (ctx) => {
			const user = await ctx.db.query('users').unique();
			await ctx.db.delete('users', user!._id);
		});
		expect(await caller.query(api.auth.isAuthenticated, {})).toBe(false);
	});

	test('does not grant system admin from a matching email environment variable', async () => {
		vi.stubEnv('SUPER_ADMIN_EMAIL', profile.email!);
		const t = setup();
		const tokens = await signUp(t);
		expect(
			await t.withIdentity({ issuer, subject: tokens.userId }).query(api.profiles.me, {})
		).toMatchObject({ systemRole: 'user' });
	});

	test('refreshes and signs out using the mounted core', async () => {
		const t = setup();
		const tokens = await signUp(t);
		const refreshed = await t.mutation(api.auth.refreshSession, {
			refreshToken: tokens.refreshToken,
		});
		expect(refreshed.kind).toBe('rotated');
		if (refreshed.kind !== 'rotated') throw new Error('Expected rotation');
		await t.mutation(api.auth.signOut, { refreshToken: refreshed.tokens.refreshToken });
		expect(
			await t.mutation(api.auth.refreshSession, { refreshToken: refreshed.tokens.refreshToken })
		).toEqual({ kind: 'noSession' });
	});

	test('personal organizations stay separate and cannot be read by a different owner', async () => {
		const t = setup();
		const first = await signUp(t);
		const second = await signUp(t, { ...profile, id: 'other-account' });
		const alice = t.withIdentity({ issuer, subject: first.userId });
		const bob = t.withIdentity({ issuer, subject: second.userId });
		const firstOrg = await alice.query(api.organizations.personal, {});
		const secondOrg = await bob.query(api.organizations.personal, {});
		expect(firstOrg?.id).not.toBe(secondOrg?.id);
		expect(firstOrg?.slug).not.toBe(secondOrg?.slug);
		expect(await t.query(api.organizations.personal, {})).toBeNull();
		// Even a corrupted cross-user pointer does not expose the other organization.
		await t.run(async (ctx) => {
			const userId = ctx.db.normalizeId('users', first.userId)!;
			await ctx.db.patch('users', userId, { personalOrganizationId: secondOrg!.id });
		});
		expect(await alice.query(api.organizations.personal, {})).toBeNull();
		await expect(signIn(t)).rejects.toThrow('PERSONAL_ORGANIZATION_CONFLICT');
	});

	test.each(['demoted', 'removed'])(
		'login never restores a %s personal owner membership',
		async (change) => {
			const t = setup();
			const tokens = await signUp(t);
			await signIn(t);
			expect(await t.run((ctx) => ctx.db.query('organizations').collect())).toHaveLength(1);
			await t.run(async (ctx) => {
				const membership = await ctx.db.query('memberships').unique();
				if (change === 'demoted')
					await ctx.db.patch('memberships', membership!._id, { role: 'moderator' });
				else await ctx.db.delete('memberships', membership!._id);
			});
			await expect(signIn(t)).rejects.toThrow('PERSONAL_ORGANIZATION_CONFLICT');
			expect(
				await t
					.withIdentity({ issuer, subject: tokens.userId })
					.query(api.organizations.personal, {})
			).toBeNull();
			const memberships = await t.run((ctx) => ctx.db.query('memberships').collect());
			expect(memberships.some((member) => member.role === 'owner')).toBe(false);
		}
	);
});
