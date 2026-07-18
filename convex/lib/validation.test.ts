import { describe, expect, it } from 'vitest';

import {
	VALIDATION_LIMITS,
	emailSchema,
	generatedSlugSchema,
	httpUrlSchema,
	normalizeSlug,
	orgSlugSchema,
	orgSlugWriteSchema,
	projectSlugSchema,
	projectSlugWriteSchema,
	usernameSchema,
} from './validation';

describe('slug validation', () => {
	it('rejects non-slug characters and malformed hyphen placement on write schemas', () => {
		expect(orgSlugWriteSchema.safeParse('valid-slug-123').success).toBe(true);
		expect(orgSlugWriteSchema.safeParse('has space').success).toBe(false);
		expect(orgSlugWriteSchema.safeParse('has_underscore').success).toBe(false);
		expect(orgSlugWriteSchema.safeParse('double--hyphen').success).toBe(false);
		expect(orgSlugWriteSchema.safeParse('-leading').success).toBe(false);
		expect(orgSlugWriteSchema.safeParse('trailing-').success).toBe(false);
	});

	it('accepts loosely-formatted slugs on read schemas so lookups never throw on rule changes', () => {
		// Read paths validate size only. A stored slug that predates a later rule
		// change must still resolve (or simply not match) rather than 400 the query.
		expect(orgSlugSchema.safeParse('Legacy_Mixed-Case').success).toBe(true);
		expect(orgSlugSchema.safeParse('trailing-').success).toBe(true);
		expect(projectSlugSchema.safeParse('weird..slug').success).toBe(true);
		// The size guard still applies.
		expect(orgSlugSchema.safeParse('a'.repeat(VALIDATION_LIMITS.orgSlug + 1)).success).toBe(false);
	});

	it('applies separate caps for org, project, and generated slugs', () => {
		expect(orgSlugSchema.safeParse('a'.repeat(VALIDATION_LIMITS.orgSlug)).success).toBe(true);
		expect(orgSlugSchema.safeParse('a'.repeat(VALIDATION_LIMITS.orgSlug + 1)).success).toBe(false);

		expect(projectSlugSchema.safeParse('a'.repeat(VALIDATION_LIMITS.projectSlug)).success).toBe(
			true
		);
		expect(projectSlugSchema.safeParse('a'.repeat(VALIDATION_LIMITS.projectSlug + 1)).success).toBe(
			false
		);

		expect(generatedSlugSchema.safeParse('a'.repeat(VALIDATION_LIMITS.generatedSlug)).success).toBe(
			true
		);
		expect(
			generatedSlugSchema.safeParse('a'.repeat(VALIDATION_LIMITS.generatedSlug + 1)).success
		).toBe(false);
	});

	it('normalizes generated slugs with the requested cap', () => {
		expect(normalizeSlug('  A Slug!! With___Noise  ', 20)).toBe('a-slug-withnoise');
		expect(normalizeSlug('Name With A Very Long Tail', 9)).toBe('name-with');
	});

	it('allows reserved slugs on read schemas for legacy rows', () => {
		expect(orgSlugSchema.safeParse('settings').success).toBe(true);
		expect(projectSlugSchema.safeParse('feedback').success).toBe(true);
	});

	it('rejects reserved slugs and usernames on write schemas', () => {
		expect(orgSlugWriteSchema.safeParse('settings').success).toBe(false);
		expect(projectSlugWriteSchema.safeParse('new').success).toBe(false);
		expect(usernameSchema.safeParse('deleted_feedback').success).toBe(false);
		expect(usernameSchema.safeParse('valid_user').success).toBe(true);
	});
});

describe('URL and email validation', () => {
	it('only accepts http and https URLs', () => {
		expect(httpUrlSchema.safeParse('https://example.com/path').success).toBe(true);
		expect(httpUrlSchema.safeParse('http://localhost:3000').success).toBe(true);
		expect(httpUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
		expect(httpUrlSchema.safeParse('data:text/html,hi').success).toBe(false);
		expect(httpUrlSchema.safeParse('ftp://example.com/file').success).toBe(false);
	});

	it('normalizes email input', () => {
		expect(emailSchema.parse('  PERSON@Example.COM ')).toBe('person@example.com');
		expect(emailSchema.safeParse('a'.repeat(255) + '@example.com').success).toBe(false);
	});
});
