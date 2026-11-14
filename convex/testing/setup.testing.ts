import type { TestConvex } from 'convex-test';
import type { GenericId } from 'convex/values';

import { sessionIdentity } from '@convex-dev/auth/test';
import { vi } from 'vitest';

import { components } from '../native/_generated/api';

export const issuer = 'https://native-integration.convex.site';
export async function configureTestAuth() {
	vi.stubEnv('CONVEX_SITE_URL', issuer);
	vi.stubEnv('AUTH_APP_ORIGIN', 'https://native.example.test');
}

// Convex Auth 2.0 access tokens name a session, not a user, so a test caller
// needs a real session in the core component (registerCore). This mints one
// for an existing user without running a sign-in method's callbacks.
export async function sessionFor(t: TestConvex<any>, userId: GenericId<'users'> | string) {
	const tokens = await t.run((ctx) =>
		ctx.runMutation(components.auth.public._internal_dangerous_signIn, {
			claims: { method: 'test', profile: {} },
			componentPath: 'test',
			userId,
			accessTokenTtlSeconds: 60,
			refreshInactivityTimeoutSeconds: 30 * 24 * 60 * 60,
			sessionMaxLifetimeSeconds: 30 * 24 * 60 * 60,
		})
	);
	return sessionIdentity(tokens);
}

// A throwaway RSA private key (PKCS#8 PEM), e.g. for a GitHub App key.
export async function testRsaPrivateKeyPem() {
	const keys = await crypto.subtle.generateKey(
		{
			name: 'RSASSA-PKCS1-v1_5',
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: 'SHA-256',
		},
		true,
		['sign', 'verify']
	);
	const pkcs8 = await crypto.subtle.exportKey('pkcs8', keys.privateKey);
	return `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...new Uint8Array(pkcs8)))
		.match(/.{1,64}/g)!
		.join('\n')}\n-----END PRIVATE KEY-----`;
}
