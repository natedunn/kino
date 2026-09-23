// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import type { FunctionReference, RegisteredMutation } from 'convex/server';
import type * as handlers from './email-fixture/auth';

import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { componentsGeneric, makeFunctionReference } from 'convex/server';
import { exportJWK, exportPKCS8, generateKeyPair } from 'jose';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import coreTesting from '../.upstream/packages/core/src/components/testing/core.ts';
import { registerPasswordProvider } from '../.upstream/packages/core/src/components/testing/password.ts';
import { mailbox } from './email-fixture/mail';
import schema from './email-fixture/schema';

const modules = import.meta.glob('./email-fixture/**/*.ts');
const audit = (
	componentsGeneric() as unknown as {
		auth: {
			proofAudit: {
				counts: FunctionReference<
					'query',
					'public',
					Record<string, never>,
					{ accounts: number; sessions: number }
				>;
			};
		};
	}
).auth.proofAudit.counts;
type Ref<T> =
	T extends RegisteredMutation<'public', infer A, infer R>
		? FunctionReference<'mutation', 'public', A, Awaited<R>>
		: never;
function fn<K extends keyof typeof handlers>(name: K): Ref<(typeof handlers)[K]> {
	return makeFunctionReference(`auth:${name}`) as Ref<(typeof handlers)[K]>;
}
const PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'another long secret sentence';
const EMAIL = 'alice@example.test';
const invalid = { status: 'error', userError: { error: 'INVALID_CREDENTIALS' } };

beforeEach(async () => {
	const keys = await generateKeyPair('RS256', { extractable: true });
	vi.stubEnv('AUTH_PRIVATE_KEY', btoa(await exportPKCS8(keys.privateKey)));
	vi.stubEnv(
		'AUTH_JWKS',
		JSON.stringify({
			keys: [
				{ ...(await exportJWK(keys.publicKey)), kid: 'email-proof', alg: 'RS256', use: 'sig' },
			],
		})
	);
	vi.stubEnv('CONVEX_SITE_URL', 'https://email-proof.convex.site');
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
async function mail(t: Backend, purpose: 'verify' | 'reset') {
	await t.finishAllScheduledFunctions(() => vi.runAllTimers());
	const message = mailbox.filter((m) => m.purpose === purpose).at(-1);
	if (!message) throw new Error(`No ${purpose} mail delivered`);
	return message.code;
}
async function pending(t: Backend) {
	expect(await t.mutation(fn('signUp'), { email: EMAIL, password: PASSWORD })).toEqual({
		status: 'accepted',
	});
	return mail(t, 'verify');
}
async function verified(t: Backend) {
	return t.mutation(fn('verifyEmail'), { code: await pending(t) });
}
async function resetCode(t: Backend) {
	expect(await t.mutation(fn('requestEmail'), { email: EMAIL, purpose: 'reset' })).toEqual({
		status: 'accepted',
	});
	return mail(t, 'reset');
}

test('signup stores only a proof hash, creates no session, and blocks password login until verification', async () => {
	const t = setup();
	const code = await pending(t);
	const proofs = await t.run((ctx) => ctx.db.query('challenges').take(10));
	expect(proofs).toHaveLength(1);
	expect(proofs[0].hash).not.toBe(code);
	expect(JSON.stringify(proofs)).not.toContain(code);
	expect(await t.query(audit, {})).toEqual({ accounts: 1, sessions: 0 });
	expect(await t.mutation(fn('signIn'), { email: EMAIL, password: PASSWORD })).toEqual(invalid);
	const result = await t.mutation(fn('verifyEmail'), { code });
	expect(result.status).toBe('complete');
	expect(await t.query(audit, {})).toEqual({ accounts: 1, sessions: 1 });
	const login = await t.mutation(fn('signIn'), {
		email: ' ALICE@EXAMPLE.TEST ',
		password: PASSWORD,
	});
	expect(login.status).toBe('complete');
	if (login.status === 'complete') expect(login.tokens.userId).toBe(result.tokens.userId);
});

test('verification rejects wrong, expired, and replayed codes', async () => {
	const t = setup();
	const code = await pending(t);
	await expect(t.mutation(fn('verifyEmail'), { code: 'wrong' })).rejects.toThrow('INVALID_PROOF');
	vi.setSystemTime(Date.now() + 15 * 60_000);
	await expect(t.mutation(fn('verifyEmail'), { code })).rejects.toThrow('INVALID_PROOF');
	await t.mutation(fn('requestEmail'), { email: EMAIL, purpose: 'verify' });
	const fresh = await mail(t, 'verify');
	await t.mutation(fn('verifyEmail'), { code: fresh });
	await expect(t.mutation(fn('verifyEmail'), { code: fresh })).rejects.toThrow('INVALID_PROOF');
});

test('resend invalidates the older proof and rate limits persist across rejected requests', async () => {
	const t = setup();
	const old = await pending(t);
	await t.mutation(fn('requestEmail'), { email: EMAIL, purpose: 'verify' });
	const fresh = await mail(t, 'verify');
	expect(fresh).not.toBe(old);
	await expect(t.mutation(fn('verifyEmail'), { code: old })).rejects.toThrow('INVALID_PROOF');
	await t.mutation(fn('requestEmail'), { email: EMAIL, purpose: 'verify' });
	for (let i = 0; i < 2; i++)
		expect(await t.mutation(fn('requestEmail'), { email: EMAIL, purpose: 'verify' })).toEqual({
			status: 'error',
			userError: { error: 'RATE_LIMITED' },
		});
});

test('duplicate normalized signup cannot replace the password or create another user', async () => {
	const t = setup();
	const code = await pending(t);
	await t.mutation(fn('signUp'), { email: ' ALICE@example.test ', password: NEW_PASSWORD });
	expect(await t.run((ctx) => ctx.db.query('users').take(10))).toHaveLength(1);
	await t.mutation(fn('verifyEmail'), { code });
	expect(await t.mutation(fn('signIn'), { email: EMAIL, password: NEW_PASSWORD })).toEqual(invalid);
	expect((await t.mutation(fn('signIn'), { email: EMAIL, password: PASSWORD })).status).toBe(
		'complete'
	);
});

test('invalid initial password rolls back the user, core account, and scheduled delivery', async () => {
	const t = setup();
	await expect(t.mutation(fn('signUp'), { email: EMAIL, password: 'short' })).rejects.toThrow();
	expect(await t.run((ctx) => ctx.db.query('users').take(10))).toEqual([]);
	expect(await t.query(audit, {})).toEqual({ accounts: 0, sessions: 0 });
	await t.finishAllScheduledFunctions(() => vi.runAllTimers());
	expect(mailbox).toEqual([]);
});

test('failed completion rolls back verification, proof consumption, and session issuance', async () => {
	const t = setup();
	const code = await pending(t);
	const userId = await t.run(async (ctx) => {
		const user = (await ctx.db.query('users').take(1))[0];
		await ctx.db.patch(user._id, { rejectSignIn: true });
		return user._id;
	});
	await expect(t.mutation(fn('verifyEmail'), { code })).rejects.toThrow('SIGN_IN_REJECTED');
	expect((await t.run((ctx) => ctx.db.get(userId)))?.verified).toBe(false);
	expect(await t.run((ctx) => ctx.db.query('challenges').take(10))).toHaveLength(1);
	expect(await t.query(audit, {})).toEqual({ accounts: 1, sessions: 0 });
	await t.run((ctx) => ctx.db.patch(userId, { rejectSignIn: false }));
	expect((await t.mutation(fn('verifyEmail'), { code })).status).toBe('complete');
});

test('unknown and unverified recovery requests return the same acknowledgment and send no reset email', async () => {
	const t = setup();
	await pending(t);
	for (const email of [EMAIL, 'missing@example.test']) {
		expect(await t.mutation(fn('requestEmail'), { email, purpose: 'reset' })).toEqual({
			status: 'accepted',
		});
	}
	await t.finishAllScheduledFunctions(() => vi.runAllTimers());
	expect(mailbox.filter((m) => m.purpose === 'reset')).toEqual([]);
});

test('password reset rejects verification proofs, changes credentials, and is single-use', async () => {
	const t = setup();
	const verifyCode = await pending(t);
	await expect(
		t.mutation(fn('resetPassword'), { code: verifyCode, password: NEW_PASSWORD })
	).rejects.toThrow('INVALID_PROOF');
	await t.mutation(fn('verifyEmail'), { code: verifyCode });
	const code = await resetCode(t);
	await expect(t.mutation(fn('verifyEmail'), { code })).rejects.toThrow('INVALID_PROOF');
	await t.mutation(fn('resetPassword'), { code, password: NEW_PASSWORD });
	await expect(t.mutation(fn('resetPassword'), { code, password: PASSWORD })).rejects.toThrow(
		'INVALID_PROOF'
	);
	expect(await t.mutation(fn('signIn'), { email: EMAIL, password: PASSWORD })).toEqual(invalid);
	expect((await t.mutation(fn('signIn'), { email: EMAIL, password: NEW_PASSWORD })).status).toBe(
		'complete'
	);
});

test('a rejected new password leaves the reset proof and existing credential intact', async () => {
	const t = setup();
	await verified(t);
	const code = await resetCode(t);
	await expect(t.mutation(fn('resetPassword'), { code, password: 'short' })).rejects.toThrow();
	expect((await t.mutation(fn('signIn'), { email: EMAIL, password: PASSWORD })).status).toBe(
		'complete'
	);
	await t.mutation(fn('resetPassword'), { code, password: NEW_PASSWORD });
});

test('documents the upstream gap: a pre-reset session still refreshes after password replacement', async () => {
	const t = setup();
	const before = await verified(t);
	await t.mutation(fn('resetPassword'), { code: await resetCode(t), password: NEW_PASSWORD });
	const refresh = await t.mutation(fn('refreshSession'), {
		refreshToken: before.tokens.refreshToken,
	});
	// This is evidence of an unmet production requirement, not desired behavior.
	expect(refresh.kind).toBe('rotated');
});

test('unknown password login returns a generic error and repeated failures consume rate limits', async () => {
	const t = setup();
	for (let i = 0; i < 5; i++)
		expect(await t.mutation(fn('signIn'), { email: EMAIL, password: PASSWORD })).toEqual(invalid);
	expect(await t.mutation(fn('signIn'), { email: EMAIL, password: PASSWORD })).toEqual({
		status: 'error',
		userError: { error: 'RATE_LIMITED' },
	});
});

test('reset resend invalidates the older code, and the replacement also expires', async () => {
	const t = setup();
	await verified(t);
	const old = await resetCode(t);
	const fresh = await resetCode(t);
	expect(fresh).not.toBe(old);
	await expect(
		t.mutation(fn('resetPassword'), { code: old, password: NEW_PASSWORD })
	).rejects.toThrow('INVALID_PROOF');
	vi.setSystemTime(Date.now() + 15 * 60_000);
	await expect(
		t.mutation(fn('resetPassword'), { code: fresh, password: NEW_PASSWORD })
	).rejects.toThrow('INVALID_PROOF');
	expect((await t.mutation(fn('signIn'), { email: EMAIL, password: PASSWORD })).status).toBe(
		'complete'
	);
});

test('known and unknown reset requests have identical public response shapes', async () => {
	const t = setup();
	await verified(t);
	const known = await t.mutation(fn('requestEmail'), { email: EMAIL, purpose: 'reset' });
	const unknown = await t.mutation(fn('requestEmail'), {
		email: 'missing@example.test',
		purpose: 'reset',
	});
	expect(known).toEqual(unknown);
	await t.finishAllScheduledFunctions(() => vi.runAllTimers());
	expect(mailbox.filter((m) => m.purpose === 'reset')).toHaveLength(1);
});

test('two verification attempts can issue at most one session in the test runtime', async () => {
	const t = setup();
	const code = await pending(t);
	const results = await Promise.allSettled([
		t.mutation(fn('verifyEmail'), { code }),
		t.mutation(fn('verifyEmail'), { code }),
	]);
	expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
	expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
	expect(await t.query(audit, {})).toEqual({ accounts: 1, sessions: 1 });
});
