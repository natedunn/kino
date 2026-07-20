import { describe, expect, it } from 'vitest';

import {
	emailSchema,
	filterSlugInput,
	filterUsernameInput,
	FORM_LIMITS,
	normalizeSlugInput,
	orgFormSchema,
	profileFormSchema,
	projectFormSchema,
} from './validation';

describe('client slug validation', () => {
	it('rejects malformed manual slugs', () => {
		expect(orgFormSchema.safeParse({ name: 'Org', slug: 'good-slug' }).success).toBe(true);
		expect(orgFormSchema.safeParse({ name: 'Org', slug: 'bad slug' }).success).toBe(false);
		expect(orgFormSchema.safeParse({ name: 'Org', slug: 'bad_slug' }).success).toBe(false);
		expect(orgFormSchema.safeParse({ name: 'Org', slug: 'bad--slug' }).success).toBe(false);
	});

	it('caps org and project slugs before submit', () => {
		expect(
			orgFormSchema.safeParse({
				name: 'Org',
				slug: 'a'.repeat(FORM_LIMITS.orgSlug + 1),
			}).success
		).toBe(false);
		expect(
			projectFormSchema.safeParse({
				name: 'Project',
				slug: 'a'.repeat(FORM_LIMITS.projectSlug + 1),
			}).success
		).toBe(false);
	});

	it('normalizes derived slugs to the given cap', () => {
		expect(normalizeSlugInput(' New Board ### Name ', FORM_LIMITS.projectSlug)).toBe(
			'new-board-name'
		);
		expect(normalizeSlugInput('Long Board Name', 10)).toBe('long-board');
	});

	it('filters live slug input without blocking hyphen typing', () => {
		// A trailing hyphen must survive so the user can keep typing "my-org".
		expect(filterSlugInput('my-', FORM_LIMITS.orgSlug)).toBe('my-');
		expect(filterSlugInput('My Org!', FORM_LIMITS.orgSlug)).toBe('my-org');
		expect(filterSlugInput('a@b#c', FORM_LIMITS.orgSlug)).toBe('abc');
		expect(filterSlugInput('a'.repeat(50), 10)).toBe('a'.repeat(10));
	});

	it('filters live username input, keeping underscores', () => {
		expect(filterUsernameInput('My_User', FORM_LIMITS.username)).toBe('my_user');
		expect(filterUsernameInput('a b', FORM_LIMITS.username)).toBe('a_b');
		expect(filterUsernameInput('bad-name!', FORM_LIMITS.username)).toBe('badname');
	});

	it('rejects reserved slugs and usernames', () => {
		expect(orgFormSchema.safeParse({ name: 'Org', slug: 'settings' }).success).toBe(false);
		expect(projectFormSchema.safeParse({ name: 'Project', slug: 'new' }).success).toBe(false);
		expect(
			profileFormSchema.safeParse({
				name: 'Person',
				username: 'deleted_feedback',
			}).success
		).toBe(false);
	});
});

describe('client email validation', () => {
	it('normalizes email input', () => {
		expect(emailSchema.parse('  TEAMMATE@Example.COM ')).toBe('teammate@example.com');
		expect(emailSchema.safeParse('not an email').success).toBe(false);
		expect(emailSchema.safeParse('a'.repeat(255) + '@example.com').success).toBe(false);
	});
});
