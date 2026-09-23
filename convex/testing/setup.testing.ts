import { vi } from 'vitest';

export const issuer = 'https://native-integration.convex.site';
export async function configureTestAuth() {
	vi.stubEnv('CONVEX_SITE_URL', issuer);
	vi.stubEnv('AUTH_APP_ORIGIN', 'https://native.example.test');
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
	const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...new Uint8Array(pkcs8)))
		.match(/.{1,64}/g)!
		.join('\n')}\n-----END PRIVATE KEY-----`;
	vi.stubEnv('AUTH_PRIVATE_KEY', btoa(pem));
	vi.stubEnv(
		'AUTH_JWKS',
		JSON.stringify({
			keys: [
				{
					...(await crypto.subtle.exportKey('jwk', keys.publicKey)),
					kid: 'test',
					alg: 'RS256',
					use: 'sig',
				},
			],
		})
	);
}
