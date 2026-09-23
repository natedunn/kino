import { describe, expect, test } from 'vitest';

import { parseAuthLinkCode } from './use-auth-link-code';

describe('parseAuthLinkCode', () => {
	test('accepts only a 256-bit lowercase hexadecimal fragment code', () => {
		const code = 'a'.repeat(64);
		expect(parseAuthLinkCode(`#code=${code}`)).toBe(code);
		expect(parseAuthLinkCode(`#other=value&code=${code}`)).toBe(code);
	});

	test.each(['', '#code=short', `#code=${'A'.repeat(64)}`, `#code=${'a'.repeat(65)}`])(
		'rejects %s',
		(fragment) => expect(parseAuthLinkCode(fragment)).toBeNull()
	);
});
