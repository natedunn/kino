import type { GatewayEnv } from './env';

import { describe, expect, it } from 'vitest';

import { isTrustedTargetUrl, timingSafeEqualString } from './env';

const devEnv = {
	TRUSTED_TARGET_PATTERNS:
		'https://*-kino.hello-fc8.workers.dev,https://kino.hello-fc8.workers.dev,https://*.kino.localhost:*,http://localhost:*,https://*.convex.site',
} as GatewayEnv;

describe('isTrustedTargetUrl', () => {
	it('accepts tier preview, local, and convex site targets', () => {
		expect(
			isTrustedTargetUrl(devEnv, 'https://feature-x-kino.hello-fc8.workers.dev/api/github/callback')
		).toBe(true);
		expect(
			isTrustedTargetUrl(devEnv, 'https://neptune.kino.localhost:1355/api/github/callback')
		).toBe(true);
		expect(
			isTrustedTargetUrl(devEnv, 'https://happy-otter-123.convex.site/api/github/webhook')
		).toBe(true);
		expect(isTrustedTargetUrl(devEnv, 'http://localhost:3000/cb')).toBe(true);
	});

	it('rejects untrusted origins and protocols', () => {
		expect(isTrustedTargetUrl(devEnv, 'https://evil.com/api/github/webhook')).toBe(false);
		expect(isTrustedTargetUrl(devEnv, 'https://kino.hello-fc8.workers.dev.evil.com/cb')).toBe(
			false
		);
		expect(isTrustedTargetUrl(devEnv, 'ftp://localhost:3000/cb')).toBe(false);
		expect(isTrustedTargetUrl(devEnv, 'not a url')).toBe(false);
	});
});

describe('timingSafeEqualString', () => {
	it('compares strings safely', () => {
		expect(timingSafeEqualString('abc', 'abc')).toBe(true);
		expect(timingSafeEqualString('abc', 'abd')).toBe(false);
		expect(timingSafeEqualString('abc', 'abcd')).toBe(false);
	});
});
