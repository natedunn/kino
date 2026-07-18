import { describe, expect, it } from 'vitest';

import {
	RESERVED_HANDLES as CLIENT_RESERVED_HANDLES,
	SLUG_PATTERN as CLIENT_SLUG_PATTERN,
	FORM_LIMITS,
	normalizeSlugInput,
} from '../../src/lib/validation';
import {
	RESERVED_HANDLES as SERVER_RESERVED_HANDLES,
	SLUG_PATTERN as SERVER_SLUG_PATTERN,
	VALIDATION_LIMITS,
	normalizeSlug,
} from './validation';

// The client (`src/lib/validation.ts`) and server (`convex/lib/validation.ts`)
// each keep their own copy of these constants because they live in separate
// build contexts. This test fails the moment they drift, so a reserved word or
// slug-rule change made in one copy can't silently desync the other.
describe('client/server validation parity', () => {
	it('keeps the reserved-handle lists identical', () => {
		expect([...CLIENT_RESERVED_HANDLES]).toEqual([...SERVER_RESERVED_HANDLES]);
	});

	it('keeps the slug pattern identical', () => {
		expect(CLIENT_SLUG_PATTERN.source).toBe(SERVER_SLUG_PATTERN.source);
		expect(CLIENT_SLUG_PATTERN.flags).toBe(SERVER_SLUG_PATTERN.flags);
	});

	it('keeps every shared length limit identical', () => {
		// The client `FORM_LIMITS` is a subset of the server `VALIDATION_LIMITS`.
		// Every key the client knows about must match the server exactly, otherwise
		// a form could accept input the server rejects (or vice versa).
		for (const key of Object.keys(FORM_LIMITS) as Array<keyof typeof FORM_LIMITS>) {
			expect(
				VALIDATION_LIMITS,
				`VALIDATION_LIMITS is missing the shared key "${key}"`
			).toHaveProperty(key);
			expect(FORM_LIMITS[key], `length limit "${key}" drifted between client and server`).toBe(
				VALIDATION_LIMITS[key as keyof typeof VALIDATION_LIMITS]
			);
		}
	});

	it('keeps slug normalization identical across client and server', () => {
		// `normalizeSlug` (server) and `normalizeSlugInput` (client) are copy-paste
		// twins; this guards against one being changed without the other.
		const samples = [
			'Hello World',
			'  Trim Me  ',
			'multiple   spaces',
			'Weird__Chars!!??',
			'--leading-and-trailing--',
			'MiXeD-CaSe-123',
			'emoji 🚀 stripped',
			'a'.repeat(100),
			'',
		];
		for (const max of [30, 39, 64]) {
			for (const sample of samples) {
				expect(
					normalizeSlugInput(sample, max),
					`normalizeSlug drift for "${sample}" (max ${max})`
				).toBe(normalizeSlug(sample, max));
			}
		}
	});
});
