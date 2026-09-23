import { describe, expect, it } from 'vitest';

import { expiredNativeSessionRedirectUrl } from './native-client';

describe('expired native session redirect', () => {
	it('preserves the protected path, query and fragment', () => {
		expect(
			expiredNativeSessionRedirectUrl(
				'https://kino.example/@hello/project/feedback/item?tab=activity#answer'
			)
		).toBe(
			'https://kino.example/auth?redirect=%2F%40hello%2Fproject%2Ffeedback%2Fitem%3Ftab%3Dactivity%23answer'
		);
	});

	it('does not create auth or home redirect loops', () => {
		expect(expiredNativeSessionRedirectUrl('https://kino.example/auth?redirect=%2Fauth')).toBe(
			'https://kino.example/auth'
		);
		expect(expiredNativeSessionRedirectUrl('https://kino.example/')).toBe(
			'https://kino.example/auth'
		);
	});
});
