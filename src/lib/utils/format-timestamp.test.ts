import { afterEach, describe, expect, it } from 'vitest';

import { overwriteGetLocale } from '@/paraglide/runtime.js';

import { formatFullDate, formatRelativeDay } from './format-timestamp';

const timestamp = Date.UTC(2026, 7, 28, 12);

afterEach(() => overwriteGetLocale(() => 'en-US'));

describe('localized timestamp formatting', () => {
	it.each([
		['en-US', 'August 28, 2026'],
		['es-419', '28 de agosto de 2026'],
		['zh-Hans', '2026年8月28日'],
	] as const)('formats full dates for %s', (locale, expected) => {
		overwriteGetLocale(() => locale);
		expect(formatFullDate(timestamp)).toBe(expected);
	});

	it('uses the active locale for relative dates', () => {
		overwriteGetLocale(() => 'es-419');
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		expect(formatRelativeDay(yesterday.getTime())).toBe('ayer');
	});
});
