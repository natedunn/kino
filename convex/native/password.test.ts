// @vitest-environment edge-runtime
import { registerCore } from '@convex-dev/auth/providers/testing/core';
import { registerPasswordProvider } from '@convex-dev/auth/providers/testing/password';
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { configureTestAuth, issuer } from '../testing/setup.testing';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.testing.ts']);
const email = 'native@example.test';
const password = 'Native-initial-39!password';
const replacement = 'Native-replacement-72!password';
type Mail = { to: string; subject: string; html_body: string };
let emails: Array<Mail>;
let transport: ReturnType<typeof vi.fn>;
beforeEach(async () => {
	await configureTestAuth();
	vi.useFakeTimers();
	for (const key of ['BENTO_PUBLISHABLE_KEY', 'BENTO_SECRET_KEY', 'BENTO_SITE_UUID', 'BENTO_FROM'])
		vi.stubEnv(key, 'test-only');
	emails = [];
	transport = vi.fn(async (_url: unknown, options: RequestInit) => {
		emails.push(...JSON.parse(options.body as string).emails);
		return new Response(JSON.stringify({ results: 1 }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	});
	vi.stubGlobal('fetch', transport);
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});
function setup() {
	const t = convexTest(schema, modules);
	registerCore(t);
	registerPasswordProvider(t, 'password');
	registerRateLimiter(t, 'authLimits');
	return t;
}
type Backend = ReturnType<typeof setup>;
async function flush(t: Backend) {
	await t.finishAllScheduledFunctions(vi.runAllTimers);
}
function code(index = emails.length - 1) {
	const match = emails[index]?.html_body.match(/#code=([a-f0-9]{64})/);
	if (!match) throw new Error('Expected a code in captured email');
	return match[1];
}
async function signUp(t: Backend, locale: 'en-US' | 'es-419' | 'zh-Hans' = 'en-US') {
	expect(
		await t.mutation(api.password.signUp, { email, password, name: 'Native User', locale })
	).toEqual({ status: 'accepted' });
	await flush(t);
	return code();
}
async function verified(t: Backend) {
	return t.mutation(api.password.verifyEmail, { code: await signUp(t) });
}

describe('native verified password lifecycle', () => {
	test.each(['en-US', 'es-419', 'zh-Hans'] as const)(
		'creates no profile or organization before verification; localized %s mail',
		async (locale) => {
			const t = setup();
			const proof = await signUp(t, locale);
			expect(emails[0].html_body).toContain(`lang="${locale}"`);
			expect(emails[0].html_body).toContain('https://native.example.test/auth/verify-email#code=');
			expect(await t.run((ctx) => ctx.db.query('profiles').collect())).toEqual([]);
			expect(await t.run((ctx) => ctx.db.query('organizations').collect())).toEqual([]);
			expect(await t.mutation(api.password.signIn, { email, password })).toMatchObject({
				userError: { error: 'INVALID_CREDENTIALS' },
			});
			const result = await t.mutation(api.password.verifyEmail, { code: proof });
			const caller = t.withIdentity({ issuer, subject: result.tokens.userId });
			expect(await caller.query(api.profiles.me, {})).toMatchObject({
				name: 'Native User',
				email,
				systemRole: 'user',
			});
			expect(await caller.query(api.organizations.personal, {})).toMatchObject({
				name: 'Native User',
				role: 'owner',
			});
			expect((await t.run((ctx) => ctx.db.query('profiles').unique()))?.locale).toBe(locale);
			await expect(t.mutation(api.password.verifyEmail, { code: proof })).rejects.toThrow(
				'INVALID_PROOF'
			);
			expect(await t.mutation(api.password.signIn, { email, password })).toMatchObject({
				status: 'complete',
			});
			expect(await t.run((ctx) => ctx.db.query('organizations').collect())).toHaveLength(1);
		}
	);
	test('replacement mail invalidates the old link and suppresses its queued delivery', async () => {
		const t = setup();
		await t.mutation(api.password.signUp, { email, password, name: 'Test' });
		await t.mutation(api.password.requestEmail, { email, purpose: 'verify' });
		await flush(t);
		expect(emails).toHaveLength(1);
		const old = code();
		await t.mutation(api.password.requestEmail, { email, purpose: 'verify' });
		await flush(t);
		expect(code()).not.toBe(old);
		expect(await t.run((ctx) => ctx.db.query('authChallenges').collect())).toHaveLength(1);
		await expect(t.mutation(api.password.verifyEmail, { code: old })).rejects.toThrow(
			'INVALID_PROOF'
		);
		await t.mutation(api.password.verifyEmail, { code: code() });
	});
	test('duplicate signup cannot replace credentials; reset revokes rotated, spent and separate sessions', async () => {
		const t = setup();
		const initial = await verified(t);
		expect(
			await t.mutation(api.password.signUp, {
				email: ' Native@Example.Test ',
				password: replacement,
				name: 'Attacker',
			})
		).toEqual({ status: 'accepted' });
		expect(await t.mutation(api.password.signIn, { email, password: replacement })).toMatchObject({
			status: 'error',
		});
		const second = await t.mutation(api.password.signIn, { email, password });
		if (second.status !== 'complete') throw new Error('Expected second session');
		const rotation = await t.mutation(api.auth.refreshSession, {
			refreshToken: initial.tokens.refreshToken,
		});
		if (rotation.kind !== 'rotated') throw new Error('Expected rotated session');
		await t.mutation(api.password.requestEmail, { email, purpose: 'reset' });
		await flush(t);
		const proof = code();
		expect(
			await t.mutation(api.password.resetPassword, { code: proof, password: 'short' })
		).toMatchObject({ userError: { error: 'PASSWORD_TOO_SHORT' } });
		expect(
			await t.mutation(api.password.resetPassword, { code: proof, password: replacement })
		).toEqual({ status: 'passwordUpdated' });
		for (const refreshToken of [
			initial.tokens.refreshToken,
			rotation.tokens.refreshToken,
			second.tokens.refreshToken,
		]) {
			expect(await t.mutation(api.auth.refreshSession, { refreshToken })).toEqual({
				kind: 'noSession',
			});
		}
		await expect(t.mutation(api.password.resetPassword, { code: proof, password })).rejects.toThrow(
			'INVALID_PROOF'
		);
		expect(await t.mutation(api.password.signIn, { email, password })).toMatchObject({
			status: 'error',
		});
		expect(await t.mutation(api.password.signIn, { email, password: replacement })).toMatchObject({
			status: 'complete',
		});
	});
	test('expired, wrong-purpose and disabled-account links cannot grant a session', async () => {
		const t = setup();
		const proof = await signUp(t);
		await expect(
			t.mutation(api.password.resetPassword, { code: proof, password: replacement })
		).rejects.toThrow('INVALID_PROOF');
		vi.advanceTimersByTime(15 * 60_000);
		await expect(t.mutation(api.password.verifyEmail, { code: proof })).rejects.toThrow(
			'INVALID_PROOF'
		);
		await t.mutation(api.password.requestEmail, { email, purpose: 'verify' });
		await flush(t);
		await t.run(async (ctx) => {
			const user = await ctx.db.query('users').unique();
			await ctx.db.patch('users', user!._id, { status: 'disabled' });
		});
		await expect(t.mutation(api.password.verifyEmail, { code: code() })).rejects.toThrow(
			'INVALID_PROOF'
		);
		expect(await t.mutation(api.password.requestEmail, { email, purpose: 'reset' })).toEqual({
			status: 'accepted',
		});
		await flush(t);
		expect(emails).toHaveLength(2);
	});
	test('mail is required; unknown and OAuth-only recipients get no password-recovery grant', async () => {
		const t = setup();
		vi.stubEnv('BENTO_SECRET_KEY', '');
		expect(await t.mutation(api.password.signUp, { email, password, name: 'Test' })).toMatchObject({
			userError: { error: 'EMAIL_UNAVAILABLE' },
		});
		expect(await t.run((ctx) => ctx.db.query('users').collect())).toEqual([]);
		vi.stubEnv('BENTO_SECRET_KEY', 'test-only');
		await t.run((ctx) =>
			ctx.db.insert('users', {
				status: 'active',
				systemRole: 'user',
				githubEmail: email,
				githubEmailVerifiedAt: Date.now(),
				githubAccountId: '42',
			})
		);
		for (const recipient of [email, 'missing@example.test']) {
			expect(
				await t.mutation(api.password.requestEmail, { email: recipient, purpose: 'reset' })
			).toEqual({ status: 'accepted' });
		}
		await flush(t);
		expect(emails).toEqual([]);
	});
	test('limits requests even for nonexistent accounts', async () => {
		const t = setup();
		for (let i = 0; i < 3; i++)
			expect(await t.mutation(api.password.requestEmail, { email, purpose: 'reset' })).toEqual({
				status: 'accepted',
			});
		expect(await t.mutation(api.password.requestEmail, { email, purpose: 'reset' })).toMatchObject({
			userError: { error: 'RATE_LIMITED' },
		});
	});

	test('disabling an account invalidates an outstanding reset and blocks login', async () => {
		const t = setup();
		await verified(t);
		await t.mutation(api.password.requestEmail, { email, purpose: 'reset' });
		await flush(t);
		const proof = code();
		await t.run(async (ctx) => {
			const user = await ctx.db.query('users').unique();
			await ctx.db.patch('users', user!._id, { status: 'disabled' });
		});
		await expect(
			t.mutation(api.password.resetPassword, { code: proof, password: replacement })
		).rejects.toThrow('INVALID_PROOF');
		expect(await t.mutation(api.password.signIn, { email, password })).toMatchObject({
			userError: { error: 'INVALID_CREDENTIALS' },
		});
	});

	test('weak passwords create no account; password signup never adopts a matching GitHub identity', async () => {
		const t = setup();
		expect(
			await t.mutation(api.password.signUp, { email, password: 'short', name: 'Test' })
		).toMatchObject({ userError: { error: 'PASSWORD_TOO_SHORT' } });
		expect(await t.run((ctx) => ctx.db.query('users').collect())).toEqual([]);
		const githubId = await t.run((ctx) =>
			ctx.db.insert('users', {
				status: 'active',
				systemRole: 'user',
				githubEmail: email,
				githubEmailVerifiedAt: Date.now(),
				githubAccountId: '42',
			})
		);
		const result = await verified(t);
		expect(result.tokens.userId).not.toBe(githubId);
		expect(await t.run((ctx) => ctx.db.query('users').collect())).toHaveLength(2);
	});
	test('bootstrap failure rolls verification and proof consumption back', async () => {
		const t = setup();
		const proof = await signUp(t);
		await t.run(async (ctx) => {
			const user = await ctx.db.query('users').unique();
			const id = await ctx.db.insert('organizations', {
				name: 'Unrelated',
				slug: 'unrelated',
				visibility: 'private',
			});
			await ctx.db.patch('users', user!._id, { personalOrganizationId: id });
		});
		await expect(t.mutation(api.password.verifyEmail, { code: proof })).rejects.toThrow(
			'PERSONAL_ORGANIZATION_CONFLICT'
		);
		expect((await t.run((ctx) => ctx.db.query('users').unique()))?.status).toBe(
			'pendingVerification'
		);
		expect(await t.run((ctx) => ctx.db.query('profiles').collect())).toEqual([]);
		expect(await t.run((ctx) => ctx.db.query('authChallenges').collect())).toHaveLength(1);
		await t.run(async (ctx) => {
			const user = await ctx.db.query('users').unique();
			await ctx.db.patch('users', user!._id, { personalOrganizationId: undefined });
		});
		expect(await t.mutation(api.password.verifyEmail, { code: proof })).toMatchObject({
			status: 'complete',
		});
	});
	test('retries transient delivery failure without changing the proof', async () => {
		const t = setup();
		transport.mockRejectedValueOnce(new Error('Transport failure'));
		const proof = await signUp(t);
		expect(transport).toHaveBeenCalledTimes(2);
		expect(await t.mutation(api.password.verifyEmail, { code: proof })).toMatchObject({
			status: 'complete',
		});
	});
	test('cleans expired challenges in bounded batches', async () => {
		const t = setup();
		await t.run(async (ctx) => {
			const userId = await ctx.db.insert('users', {
				status: 'pendingVerification',
				systemRole: 'user',
			});
			for (let i = 0; i < 105; i++)
				await ctx.db.insert('authChallenges', {
					userId,
					purpose: 'verify',
					hash: String(i),
					expiresAt: Date.now() - 1,
				});
			await ctx.db.insert('authChallenges', {
				userId,
				purpose: 'reset',
				hash: 'valid',
				expiresAt: Date.now() + 60_000,
			});
		});
		expect(await t.mutation(internal.password.clearExpiredChallenges, {})).toBe(100);
		expect(await t.mutation(internal.password.clearExpiredChallenges, {})).toBe(5);
		expect(await t.run((ctx) => ctx.db.query('authChallenges').collect())).toHaveLength(1);
	});
});
