import { symmetricDecrypt } from 'better-auth/crypto';
import { describe, expect, it, vi } from 'vitest';

import { generateLocalJwks, planAnonymousAuthEnv } from './anonymous-auth-env.mjs';

describe('anonymous Convex auth environment', () => {
	it('generates a valid encrypted RS256 signing key', async () => {
		const secret = 'local-test-secret-that-is-at-least-32-characters';
		const jwks = JSON.parse(await generateLocalJwks(secret));

		expect(jwks).toHaveLength(1);
		expect(jwks[0]).toMatchObject({ alg: 'RS256' });
		expect(JSON.parse(jwks[0].publicKey)).toMatchObject({ kty: 'RSA' });

		const privateKey = await symmetricDecrypt({
			data: JSON.parse(jwks[0].privateKey),
			key: secret,
		});
		expect(JSON.parse(privateKey)).toMatchObject({ kty: 'RSA' });
	});

	it('installs a local JWKS before bootstrap when the source has none', async () => {
		const generateJwks = vi.fn(async () => 'local-jwks');
		const plan = await planAnonymousAuthEnv({
			generateJwks,
			sourceEnvContents: 'BETTER_AUTH_SECRET=shared-dev-secret\nBENTO_FROM=test@example.com\n',
			targetEnvContents: '',
		});

		expect(generateJwks).toHaveBeenCalledWith('shared-dev-secret');
		expect(plan.generatedJwks).toBe(true);
		expect(plan.authEnvContents).toContain("JWKS='local-jwks'");
	});

	it('never copies a source deployment signing key', async () => {
		const plan = await planAnonymousAuthEnv({
			generateJwks: async () => 'local-jwks',
			sourceEnvContents:
				'BETTER_AUTH_SECRET=shared-dev-secret\nJWKS="source-signing-key"\nBENTO_FROM=test@example.com\n',
			targetEnvContents: '',
		});

		expect(plan.copiedEnvContents).not.toContain('JWKS=');
		expect(plan.authEnvContents).toContain('local-jwks');
	});

	it('preserves an existing local key when its encryption secret is unchanged', async () => {
		const generateJwks = vi.fn(async () => 'replacement-jwks');
		const plan = await planAnonymousAuthEnv({
			generateJwks,
			sourceEnvContents: 'BETTER_AUTH_SECRET=shared-dev-secret\n',
			targetEnvContents:
				'BETTER_AUTH_SECRET=shared-dev-secret\nJWKS=[{"id":"existing-local-jwks"}]\n',
		});

		expect(generateJwks).not.toHaveBeenCalled();
		expect(plan.generatedJwks).toBe(false);
		expect(plan.authEnvContents).toBe('');
	});

	it('replaces a malformed local JWKS instead of preserving it', async () => {
		const generateJwks = vi.fn(async () => 'replacement-jwks');
		const plan = await planAnonymousAuthEnv({
			generateJwks,
			sourceEnvContents: 'BETTER_AUTH_SECRET=shared-dev-secret\n',
			targetEnvContents:
				'BETTER_AUTH_SECRET=shared-dev-secret\nJWKS=[{\\"id\\":\\"malformed-jwks\\"}]\n',
		});

		expect(generateJwks).toHaveBeenCalledWith('shared-dev-secret');
		expect(plan.generatedJwks).toBe(true);
	});

	it('rotates the local key when the copied encryption secret changes', async () => {
		const generateJwks = vi.fn(async () => 'replacement-jwks');
		const plan = await planAnonymousAuthEnv({
			generateJwks,
			sourceEnvContents: 'BETTER_AUTH_SECRET=new-shared-dev-secret\n',
			targetEnvContents: 'BETTER_AUTH_SECRET=old-shared-dev-secret\nJWKS="old-local-jwks"\n',
		});

		expect(generateJwks).toHaveBeenCalledWith('new-shared-dev-secret');
		expect(plan.generatedJwks).toBe(true);
		expect(plan.authEnvContents).toContain('replacement-jwks');
	});
});
