import { describe, expect, it } from 'vitest';

import { localGithubCallbackUrl } from './runtime';

describe('localGithubCallbackUrl', () => {
	it("returns the worktree's loopback Convex callback in dev", () => {
		expect(localGithubCallbackUrl('http://127.0.0.1:20373', true)).toBe(
			'http://127.0.0.1:20373/oauth/github/callback'
		);
	});

	it('never applies outside dev or to non-loopback site URLs', () => {
		expect(localGithubCallbackUrl('http://127.0.0.1:20373', false)).toBeNull();
		expect(localGithubCallbackUrl('https://happy-otter-123.convex.site', true)).toBeNull();
		expect(localGithubCallbackUrl('http://convex.example.com:3211', true)).toBeNull();
		expect(localGithubCallbackUrl('http://127.0.0.1', true)).toBeNull();
		expect(localGithubCallbackUrl('not a url', true)).toBeNull();
		expect(localGithubCallbackUrl(undefined, true)).toBeNull();
	});
});
