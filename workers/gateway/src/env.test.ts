import type { GatewayEnv } from './env';

import { describe, expect, it } from 'vitest';

import { isTrustedTargetUrl, timingSafeEqualString } from './env';

const devEnv = {
	TRUSTED_TARGET_PATTERNS:
		'https://*-kino.hello-fc8.workers.dev,https://kino.hello-fc8.workers.dev,https://*.kino.localhost:*,http://localhost:*,https://*.convex.site',
} as GatewayEnv;

describe('isTrustedTargetUrl', () => {
	it('accepts tier preview, local, and convex site targets', async () => {
		expect(
			await isTrustedTargetUrl(
				devEnv,
				'https://feature-x-kino.hello-fc8.workers.dev/api/github/callback'
			)
		).toBe(true);
		expect(
			await isTrustedTargetUrl(devEnv, 'https://neptune.kino.localhost:1355/api/github/callback')
		).toBe(true);
		expect(
			await isTrustedTargetUrl(devEnv, 'https://happy-otter-123.convex.site/api/github/webhook')
		).toBe(true);
		expect(await isTrustedTargetUrl(devEnv, 'http://localhost:3000/cb')).toBe(true);
	});

	it('rejects untrusted origins and protocols', async () => {
		expect(await isTrustedTargetUrl(devEnv, 'https://evil.com/api/github/webhook')).toBe(false);
		expect(await isTrustedTargetUrl(devEnv, 'https://kino.hello-fc8.workers.dev.evil.com/cb')).toBe(
			false
		);
		expect(await isTrustedTargetUrl(devEnv, 'ftp://localhost:3000/cb')).toBe(false);
		expect(await isTrustedTargetUrl(devEnv, 'not a url')).toBe(false);
	});
});

describe('timingSafeEqualString', () => {
	it('compares strings safely', () => {
		expect(timingSafeEqualString('abc', 'abc')).toBe(true);
		expect(timingSafeEqualString('abc', 'abd')).toBe(false);
		expect(timingSafeEqualString('abc', 'abcd')).toBe(false);
	});
});
