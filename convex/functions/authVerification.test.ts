// @vitest-environment node
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { symmetricEncrypt } from 'better-auth/crypto';
import { oAuthProxy } from 'better-auth/plugins';
import { expect, test } from 'vitest';

// Exercise the installed Better Auth callback, without GitHub/network access.
// This isolates the supported option; Convex deletion is covered in crons.test.ts.
const secret = 'test-only-oauth-proxy-secret-at-least-32-characters';
const baseURL = 'https://auth.example.test';

async function fixture(expiresAt: number, includeIssuer = true) {
	const db: Record<string, any[]> = { user: [], session: [], account: [], verification: [] };
	const auth = betterAuth({
		baseURL,
		secret,
		database: (options) => {
			const adapter = memoryAdapter(db)(options);
			// Convex rejects undefined query operands. The memory adapter alone
			// tolerates them, masking a stale gateway's missing account issuer.
			return new Proxy(adapter, {
				get(target, property, receiver) {
					if (property === 'findOne') {
						return (args: Parameters<typeof adapter.findOne>[0]) => {
							if (args.where?.some((clause) => clause.value === undefined)) {
								throw new Error('Query filter value is required');
							}
							return target.findOne(args);
						};
					}
					return Reflect.get(target, property, receiver);
				},
			});
		},
		verification: { disableCleanup: true },
		logger: { disabled: true },
		plugins: [oAuthProxy({ productionURL: 'https://gateway.example.test', secret })],
	});
	const ctx = await auth.$context;
	await ctx.internalAdapter.createVerificationValue({
		identifier: 'test-state',
		expiresAt: new Date(expiresAt),
		value: JSON.stringify({
			oauthState: 'test-state',
			callbackURL: `${baseURL}/dashboard`,
			codeVerifier: 'test-verifier',
			expiresAt,
		}),
	});
	await ctx.internalAdapter.createVerificationValue({
		identifier: 'unrelated-expired',
		value: 'old',
		expiresAt: new Date(Date.now() - 60000),
	});
	const profile = await symmetricEncrypt({
		key: secret,
		data: JSON.stringify({
			timestamp: Date.now(),
			state: 'test-state',
			callbackURL: `${baseURL}/dashboard`,
			userInfo: {
				id: 'github-user',
				name: 'Test',
				email: 'test@example.test',
				emailVerified: true,
			},
			account: {
				providerId: 'github',
				accountId: 'github-user',
				...(includeIssuer ? { issuer: 'local:oauth:github' } : {}),
			},
		}),
	});
	const callback = () =>
		auth.handler(
			new Request(
				`${baseURL}/api/auth/oauth-proxy-callback?${new URLSearchParams({ profile, callbackURL: `${baseURL}/dashboard` })}`
			)
		);
	return { db, callback };
}

test('valid OAuth state succeeds once; replay fails with inline cleanup disabled', async () => {
	const { db, callback } = await fixture(Date.now() + 600000);
	const first = await callback();
	expect(first.headers.get('location')).toBe(`${baseURL}/dashboard`);
	expect(db.session).toHaveLength(1);
	expect(db.verification.some((row) => row.identifier === 'test-state')).toBe(false);
	// The expired unrelated record proves this did not rely on an inline sweep.
	expect(db.verification.some((row) => row.identifier === 'unrelated-expired')).toBe(true);
	const replay = await callback();
	expect(replay.headers.get('location')).toContain('error=state_mismatch');
	expect(db.session).toHaveLength(1);
});

test('expired OAuth state fails even before scheduled cleanup runs', async () => {
	const { db, callback } = await fixture(Date.now() - 1000);
	expect(db.verification.some((row) => row.identifier === 'test-state')).toBe(true);
	const response = await callback();
	expect(response.headers.get('location')).toContain('error=state_mismatch');
	expect(db.session).toHaveLength(0);
});

test('a stale gateway payload without issuer cannot pass the callback fixture', async () => {
	const { db, callback } = await fixture(Date.now() + 600000, false);
	const response = await callback();
	expect(response.headers.get('location')).toContain('error=internal_server_error');
	expect(db.session).toHaveLength(0);
});
