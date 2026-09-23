// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import type { FunctionReference, RegisteredMutation } from 'convex/server';
import type { JWK } from 'jose';
import type * as handlers from './email-fixture/auth';

import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { componentsGeneric, makeFunctionReference } from 'convex/server';
import { exportJWK, exportPKCS8, generateKeyPair, importJWK, jwtVerify } from 'jose';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import coreTesting from '../.revocation/packages/core/src/components/testing/core.ts';
import { registerPasswordProvider } from '../.upstream/packages/core/src/components/testing/password.ts';
import { mailbox } from './email-fixture/mail';
import { components } from './email-fixture/refs';
import schema from './email-fixture/schema';

const modules = import.meta.glob('./email-fixture/**/*.ts');
type Ref<T> =
	T extends RegisteredMutation<'public', infer A, infer R>
		? FunctionReference<'mutation', 'public', A, Awaited<R>>
		: never;
function fn<K extends keyof typeof handlers>(name: K): Ref<(typeof handlers)[K]> {
	return makeFunctionReference(`auth:${name}`) as Ref<(typeof handlers)[K]>;
}
const legacy = (
	componentsGeneric() as unknown as {
		auth: {
			proofAudit: {
				makeLegacy: FunctionReference<'mutation', 'public', { userId: string }, null>;
			};
		};
	}
).auth.proofAudit.makeLegacy;
const PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'another long secret sentence';
const EMAIL = 'alice@example.test';
const issuer = 'https://email-proof.convex.site';
let publicKey: JWK;
beforeEach(async () => {
	const keys = await generateKeyPair('RS256', { extractable: true });
	publicKey = await exportJWK(keys.publicKey);
	vi.stubEnv('AUTH_PRIVATE_KEY', btoa(await exportPKCS8(keys.privateKey)));
	vi.stubEnv(
		'AUTH_JWKS',
		JSON.stringify({ keys: [{ ...publicKey, kid: 'proof', alg: 'RS256', use: 'sig' }] })
	);
	vi.stubEnv('CONVEX_SITE_URL', issuer);
	mailbox.length = 0;
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});
function setup() {
	const t = convexTest(schema, modules);
	t.registerComponent('auth', coreTesting.schema, {
		...coreTesting.modules,
		'../core/proofAudit.ts': () => import('./email-fixture/core-audit'),
	});
	registerPasswordProvider(t, 'password');
	registerRateLimiter(t, 'emailLimits');
	return t;
}
type Backend = ReturnType<typeof setup>;
async function code(t: Backend, email: string, purpose: 'verify' | 'reset') {
	await t.finishAllScheduledFunctions(() => vi.runAllTimers());
	const message = mailbox.filter((m) => m.email === email && m.purpose === purpose).at(-1);
	if (!message) throw new Error('Missing captured mail');
	return message.code;
}
async function user(t: Backend, email = EMAIL) {
	await t.mutation(fn('signUp'), { email, password: PASSWORD });
	return (await t.mutation(fn('verifyEmail'), { code: await code(t, email, 'verify') })).tokens;
}
async function resetCode(t: Backend) {
	await t.mutation(fn('requestEmail'), { email: EMAIL, purpose: 'reset' });
	return code(t, EMAIL, 'reset');
}
const refresh = (t: Backend, refreshToken: string) =>
	t.mutation(fn('refreshSession'), { refreshToken });
const reset = (t: Backend, proof: string) =>
	t.mutation(fn('resetPasswordWithRevocation'), { code: proof, password: NEW_PASSWORD });

test('reset revokes all old sessions, including spent tokens inside the grace window', async () => {
	const t = setup();
	const first = await user(t);
	const second = await t.mutation(fn('signIn'), { email: EMAIL, password: PASSWORD });
	expect(second.status).toBe('complete');
	if (second.status !== 'complete') throw new Error('Login failed');
	const rotated = await refresh(t, first.refreshToken);
	if (rotated.kind !== 'rotated') throw new Error('Refresh failed');
	await reset(t, await resetCode(t));
	for (const token of [
		first.refreshToken,
		rotated.tokens.refreshToken,
		second.tokens.refreshToken,
	]) {
		expect(await refresh(t, token)).toEqual({ kind: 'noSession' });
	}
	expect((await t.mutation(fn('signIn'), { email: EMAIL, password: PASSWORD })).status).toBe(
		'error'
	);
	const after = await t.mutation(fn('signIn'), { email: EMAIL, password: NEW_PASSWORD });
	if (after.status !== 'complete') throw new Error('New password failed');
	expect(after.tokens.userId).toBe(first.userId);
	expect((await refresh(t, after.tokens.refreshToken)).kind).toBe('rotated');
});

test.each(['refresh-first', 'reset-first'] as const)(
	'refresh/reset race (%s) cannot leave a refreshable old session',
	async (order) => {
		const t = setup();
		const before = await user(t);
		const proof = await resetCode(t);
		const runRefresh = () => refresh(t, before.refreshToken);
		const runReset = () => reset(t, proof);
		const results =
			order === 'refresh-first'
				? await Promise.all([runRefresh(), runReset()])
				: await Promise.all([runReset(), runRefresh()]);
		expect(await refresh(t, before.refreshToken)).toEqual({ kind: 'noSession' });
		for (const result of results)
			if ('kind' in result && result.kind === 'rotated') {
				expect(await refresh(t, result.tokens.refreshToken)).toEqual({ kind: 'noSession' });
			}
	}
);

test('revoking one user does not revoke another user', async () => {
	const t = setup();
	const alice = await user(t);
	const bob = await user(t, 'bob@example.test');
	await reset(t, await resetCode(t));
	expect(await refresh(t, alice.refreshToken)).toEqual({ kind: 'noSession' });
	expect((await refresh(t, bob.refreshToken)).kind).toBe('rotated');
});

test.each(['login-first', 'reset-first'] as const)(
	'old-password login/reset race (%s) leaves no refreshable old-credential session',
	async (order) => {
		const t = setup();
		await user(t);
		const proof = await resetCode(t);
		const login = () => t.mutation(fn('signIn'), { email: EMAIL, password: PASSWORD });
		const change = () => reset(t, proof);
		const results =
			order === 'login-first'
				? await Promise.all([login(), change()])
				: await Promise.all([change(), login()]);
		for (const result of results)
			if (result.status === 'complete') {
				expect(await refresh(t, result.tokens.refreshToken)).toEqual({ kind: 'noSession' });
			}
		expect((await login()).status).toBe('error');
	}
);

test('missing generation on a pre-patch session means zero and is revoked on reset', async () => {
	const t = setup();
	const before = await user(t);
	await t.mutation(legacy, { userId: before.userId });
	await reset(t, await resetCode(t));
	expect(await refresh(t, before.refreshToken)).toEqual({ kind: 'noSession' });
});

test('failure after revocation rolls back credential replacement, proof consumption, and generation', async () => {
	const t = setup();
	const before = await user(t);
	const proof = await resetCode(t);
	const id = await t.run(async (ctx) => {
		const u = (await ctx.db.query('users').take(1))[0];
		await ctx.db.patch(u._id, { rejectResetCompletion: true });
		return u._id;
	});
	await expect(reset(t, proof)).rejects.toThrow('RESET_COMPLETION_REJECTED');
	expect((await refresh(t, before.refreshToken)).kind).toBe('rotated');
	expect((await t.mutation(fn('signIn'), { email: EMAIL, password: PASSWORD })).status).toBe(
		'complete'
	);
	expect((await t.mutation(fn('signIn'), { email: EMAIL, password: NEW_PASSWORD })).status).toBe(
		'error'
	);
	await t.run((ctx) => ctx.db.patch(id, { rejectResetCompletion: false }));
	await reset(t, proof);
	expect(await refresh(t, before.refreshToken)).toEqual({ kind: 'noSession' });
});

test('invalid reset proof has no authority to revoke; core endpoint is not a root app endpoint', async () => {
	const t = setup();
	const before = await user(t);
	await expect(reset(t, 'invalid')).rejects.toThrow('INVALID_PROOF');
	await expect(
		t.mutation(makeFunctionReference<'mutation'>('public:revokeUserSessions'), {
			userId: before.userId,
		})
	).rejects.toThrow();
	expect((await refresh(t, before.refreshToken)).kind).toBe('rotated');
});

test('repeated revocation does not revive a previous generation', async () => {
	const t = setup();
	const before = await user(t);
	await reset(t, await resetCode(t));
	const after = await t.mutation(fn('signIn'), { email: EMAIL, password: NEW_PASSWORD });
	if (after.status !== 'complete') throw new Error('Login failed');
	await t.mutation(components.auth.public.revokeUserSessions, { userId: before.userId });
	expect(await refresh(t, before.refreshToken)).toEqual({ kind: 'noSession' });
	expect(await refresh(t, after.tokens.refreshToken)).toEqual({ kind: 'noSession' });
});

test('access-token policy is bounded expiry, not immediate JWT invalidation', async () => {
	const t = setup();
	const before = await user(t);
	const key = await importJWK(publicKey, 'RS256');
	await reset(t, await resetCode(t));
	const valid = await jwtVerify(before.accessToken, key, { issuer, audience: 'convex' });
	expect(valid.payload.sub).toBe(before.userId);
	expect(valid.payload.exp! - valid.payload.iat!).toBe(60);
	expect(await refresh(t, before.refreshToken)).toEqual({ kind: 'noSession' });
	vi.setSystemTime(before.accessTokenExpiresAt + 1);
	await expect(
		jwtVerify(before.accessToken, key, { issuer, audience: 'convex' })
	).rejects.toMatchObject({ code: 'ERR_JWT_EXPIRED' });
});
