import { describe, expect, it } from 'vitest';

import { extractErrorMessage } from './errors';

describe('extractErrorMessage', () => {
	it('pulls the clean message out of a Convex-wrapped CRPCError', () => {
		const raw =
			'[CONVEX M(project:update)] [Request ID: b23037814842949e] Server Error\n' +
			'Uncaught CRPCError: This project is archived and read-only. An admin must un-archive it ' +
			'(change its visibility) to make changes. at <anonymous> (../../convex/functions/project.ts:156:5) ' +
			'at async handler (../../node_modules/.pnpm/kitcn/DBgto1yn.js:1802:18) Called by client';
		expect(extractErrorMessage({ message: raw })).toBe(
			'This project is archived and read-only. An admin must un-archive it (change its visibility) to make changes.'
		);
	});

	it('prefers a structured data.message when present', () => {
		expect(extractErrorMessage({ data: { message: 'Nice message' }, message: 'ugly raw' })).toBe(
			'Nice message'
		);
	});

	it('returns a plain message untouched', () => {
		expect(extractErrorMessage({ message: 'Network request failed' })).toBe(
			'Network request failed'
		);
	});

	it('falls back when there is no error or message', () => {
		expect(extractErrorMessage(null, 'Fallback')).toBe('Fallback');
		expect(extractErrorMessage({}, 'Fallback')).toBe('Fallback');
	});
});
