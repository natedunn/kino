import { describe, expect, it } from 'vitest';

import { getSafeRedirectTarget, getVerifyEmailCallbackUrl } from './auth';

describe('getSafeRedirectTarget', () => {
	it('defaults to the dashboard when redirect is missing', () => {
		expect(getSafeRedirectTarget(undefined)).toBe('/dashboard');
	});

	it('avoids redirecting back to the auth page after login', () => {
		expect(getSafeRedirectTarget('/auth')).toBe('/dashboard');
		expect(getSafeRedirectTarget('/auth?redirect=%2Fauth')).toBe('/dashboard');
	});

	it('avoids redirecting back to the public landing page after login', () => {
		expect(getSafeRedirectTarget('/')).toBe('/dashboard');
	});

	it('preserves safe in-app redirect paths', () => {
		expect(getSafeRedirectTarget('/acme')).toBe('/acme');
		expect(getSafeRedirectTarget('/acme/project?tab=updates#latest')).toBe(
			'/acme/project?tab=updates#latest'
		);
	});
});

describe('getVerifyEmailCallbackUrl', () => {
	it('preserves a safe in-app redirect through email verification', () => {
		expect(
			getVerifyEmailCallbackUrl(
				'https://app.usekino.com',
				'/@acme/kino/feedback/feedback-1?tab=activity#comment-2'
			)
		).toBe(
			'https://app.usekino.com/auth/verify-email?verified=1&redirect=%2F%40acme%2Fkino%2Ffeedback%2Ffeedback-1%3Ftab%3Dactivity%23comment-2'
		);
	});

	it('omits redirect search when no return target was requested', () => {
		expect(getVerifyEmailCallbackUrl('https://app.usekino.com', undefined)).toBe(
			'https://app.usekino.com/auth/verify-email?verified=1'
		);
	});
});
