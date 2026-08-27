import { describe, expect, it } from 'vitest';

import { resolveAppLocale, resolvePreferredLocale, resolveRegionLocale } from './locale';

describe('locale resolution', () => {
	it.each([
		['es-ES', 'es-419'],
		['es-MX', 'es-419'],
		['zh-Hant', 'zh-Hans'],
		['zh-TW', 'zh-Hans'],
		['en-GB', 'en-US'],
		['fr-FR', 'en-US'],
		[undefined, 'en-US'],
	] as const)('maps %s to %s', (input, expected) => {
		expect(resolveAppLocale(input)).toBe(expected);
	});

	it('honors Accept-Language quality before mapping variants', () => {
		expect(resolvePreferredLocale('fr-FR;q=0.9, es-ES;q=0.8, zh-Hant;q=0.7')).toBe('es-419');
		expect(resolvePreferredLocale('zh-Hant-TW, en-US;q=0.8')).toBe('zh-Hans');
	});

	it('defaults unsupported preferences to English', () => {
		expect(resolvePreferredLocale('fr-FR, de-DE;q=0.8')).toBe('en-US');
	});

	it.each([
		['MX', 'es-419'],
		['CO', 'es-419'],
		['CN', 'zh-Hans'],
		['TW', 'zh-Hans'],
		['US', 'en-US'],
		['FR', undefined],
	] as const)('maps region %s to %s', (country, expected) => {
		expect(resolveRegionLocale(country)).toBe(expected);
	});
});
