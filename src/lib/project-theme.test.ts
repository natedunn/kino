import {
	createProjectThemeFromAccent,
	deriveProjectThemeTokens,
	mixThemeColors,
	normalizeThemeColor,
	primaryButtonTextContrast,
	PROJECT_THEME_ACCENTS,
	PROJECT_THEME_PRESET_IDS,
	PROJECT_THEME_PRESETS,
	projectThemeCssVariables,
	readablePrimaryButtonForeground,
	themeContrastRatio,
	validateProjectTheme,
} from '@convex/project-theme';
import { describe, expect, it } from 'vitest';

import { isThemedProjectRoute, resolveProjectTheme } from './project-theme';

describe('project theme tokens', () => {
	it('normalizes only bounded hex colors', () => {
		expect(normalizeThemeColor('#AbC')).toBe('#aabbcc');
		expect(normalizeThemeColor(' #123456 ')).toBe('#123456');
		expect(normalizeThemeColor('red')).toBeNull();
		expect(normalizeThemeColor('#fff;--background:red')).toBeNull();
	});

	it.each(PROJECT_THEME_PRESET_IDS)('%s satisfies the publish contract', (presetId) => {
		const preset = PROJECT_THEME_PRESETS[presetId];
		expect(validateProjectTheme(preset)).toEqual([]);
		expect(deriveProjectThemeTokens(preset.light, 'light')).toMatchSnapshot();
		expect(deriveProjectThemeTokens(preset.dark, 'dark')).toMatchSnapshot();
	});

	it('serializes namespaced variables only', () => {
		const variables = projectThemeCssVariables(PROJECT_THEME_PRESETS.golden);
		expect(Object.keys(variables).every((key) => key.startsWith('--project-'))).toBe(true);
		expect(Object.values(variables).every((value) => /^#[0-9a-f]{6}$/.test(value))).toBe(true);
	});

	it('uses WCAG contrast ratios', () => {
		expect(themeContrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
	});

	it('uses the 3.5:1 base-accent threshold for primary button text', () => {
		expect(readablePrimaryButtonForeground('#facc15')).toBe('#000000');
		expect(readablePrimaryButtonForeground('#1d4ed8')).toBe('#ffffff');
		expect(primaryButtonTextContrast('#ffffff', '#0284c7')).toBeGreaterThanOrEqual(3.5);
	});

	it('reproduces the original Kino button palette exactly', () => {
		const kino = createProjectThemeFromAccent(PROJECT_THEME_ACCENTS.kino, 'kino');
		expect(kino?.light.primary).toBe('#2563eb');
		expect(kino?.dark.primary).toBe('#3b82f6');
		expect(kino && deriveProjectThemeTokens(kino.light, 'light')).toMatchObject({
			'primary-button-active-border': '#1c398e',
			'primary-button-active-from': '#2563eb',
			'primary-button-active-to': '#193cb8',
			'primary-button-border': '#2b7fff',
			'primary-button-from': '#2563eb',
			'primary-button-hover-border': '#193cb8',
			'primary-button-hover-to': '#155dfc',
			'primary-button-to': '#51a2ff',
		});
		expect(kino && deriveProjectThemeTokens(kino.dark, 'dark')).toMatchObject({
			'primary-button-active-border': '#2b7fff',
			'primary-button-active-from': '#155dfc',
			'primary-button-active-to': '#1447e6',
			'primary-button-border': '#8ec5ff',
			'primary-button-from': '#3b82f6',
			'primary-button-hover-border': '#51a2ff',
			'primary-button-hover-to': '#155dfc',
			'primary-button-to': '#51a2ff',
		});
	});

	it('darkens non-Kino button gradients until both visible stops reach 3.5:1', () => {
		const palette = {
			...PROJECT_THEME_PRESETS.kino.light,
			primary: '#facc15',
		};
		const tokens = deriveProjectThemeTokens(palette, 'light');
		expect(tokens.primary).toBe('#facc15');
		expect(tokens['primary-button-from']).not.toBe('#facc15');
		expect(
			primaryButtonTextContrast('#ffffff', tokens['primary-button-from'])
		).toBeGreaterThanOrEqual(3.5);
		expect(
			primaryButtonTextContrast('#ffffff', tokens['primary-button-to'])
		).toBeGreaterThanOrEqual(3.5);

		const whiteTokens = deriveProjectThemeTokens({ ...palette, primary: '#ffffff' }, 'light');
		expect(
			primaryButtonTextContrast('#ffffff', whiteTokens['primary-button-to'])
		).toBeGreaterThanOrEqual(3.5);
	});

	it('keeps curated accent presets publishable without using Fix', () => {
		for (const presetId of PROJECT_THEME_PRESET_IDS) {
			if (presetId === 'custom') continue;
			const theme = createProjectThemeFromAccent(PROJECT_THEME_ACCENTS[presetId], presetId);
			expect(theme && validateProjectTheme(theme)).toEqual([]);
		}
	});

	it('adds only a trace of the accent to muted surfaces', () => {
		const theme = createProjectThemeFromAccent('#dc2626', 'red');
		expect(theme).not.toBeNull();
		if (!theme) return;

		for (const mode of ['light', 'dark'] as const) {
			const palette = theme[mode];
			const neutralMuted = mixThemeColors(
				palette.background,
				palette.foreground,
				mode === 'dark' ? 0.02 : 0.04
			);
			const tokens = deriveProjectThemeTokens(palette, mode);
			expect(tokens.muted).toBe(
				mixThemeColors(neutralMuted, palette.primary, mode === 'dark' ? 0.03 : 0.02)
			);
			expect(tokens.muted).not.toBe(neutralMuted);
			expect(themeContrastRatio(tokens.muted, neutralMuted)).toBeLessThan(1.05);

			const neutralNav =
				mode === 'dark'
					? mixThemeColors(palette.background, '#000000', 0.12)
					: mixThemeColors(palette.background, palette.foreground, 0.01);
			expect(tokens.nav).toBe(
				mixThemeColors(neutralNav, palette.primary, mode === 'dark' ? 0.02 : 0.01)
			);
			expect(themeContrastRatio(tokens.nav, palette.background)).toBeLessThan(
				themeContrastRatio(tokens.muted, palette.background)
			);
		}
	});
});

describe('project theme route boundary', () => {
	it('themes visitor routes and excludes management routes', () => {
		expect(isThemedProjectRoute('/@{$org}/$project/feedback/$slug/')).toBe(true);
		expect(isThemedProjectRoute('/@{$org}/$project/settings/appearance/')).toBe(true);
		expect(isThemedProjectRoute('/@{$org}/$project/settings/general/')).toBe(true);
		expect(isThemedProjectRoute('/@{$org}/$project/updates/new/')).toBe(false);
		expect(isThemedProjectRoute('/@{$org}/$project/integrations/github/')).toBe(false);
	});

	it('falls back for unknown persisted versions', () => {
		expect(resolveProjectTheme({ ...PROJECT_THEME_PRESETS.golden, version: 99 })).toBe(
			PROJECT_THEME_PRESETS.kino
		);
	});
});
