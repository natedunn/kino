import { clampRgb, converter, formatHex } from 'culori';

export const PROJECT_THEME_VERSION = 1 as const;

export const PROJECT_THEME_PRESET_IDS = [
	'kino',
	'red',
	'orange',
	'golden',
	'forest',
	'teal',
	'purple',
	'sunset',
	'monochrome',
	'custom',
] as const;

export type ProjectThemePresetId = (typeof PROJECT_THEME_PRESET_IDS)[number];

export function normalizeProjectThemePresetId(value: unknown): ProjectThemePresetId {
	return PROJECT_THEME_PRESET_IDS.includes(value as ProjectThemePresetId)
		? (value as ProjectThemePresetId)
		: 'custom';
}

export type ProjectThemePalette = {
	background: string;
	foreground: string;
	primary: string;
	primaryForeground: string;
	surface: string;
	surfaceForeground: string;
};

export type ProjectThemeInput = {
	dark: ProjectThemePalette;
	light: ProjectThemePalette;
	presetId: ProjectThemePresetId;
	version: typeof PROJECT_THEME_VERSION;
};

export type ProjectThemeMode = 'dark' | 'light';

export type ProjectThemeTokens = Record<string, string>;

export type ProjectThemeValidationIssue = {
	actual: number;
	label: string;
	minimum: number;
	mode: ProjectThemeMode;
};

type PrimaryButtonPalette = {
	activeBorder: string;
	activeFrom: string;
	activeTo: string;
	border: string;
	from: string;
	hoverBorder: string;
	hoverTo: string;
	to: string;
};

const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeThemeColor(value: string): string | null {
	const trimmed = value.trim();
	if (!HEX_PATTERN.test(trimmed)) return null;
	const hex = trimmed.slice(1).toLowerCase();
	return `#${
		hex.length === 3
			? hex
					.split('')
					.map((character) => character + character)
					.join('')
			: hex
	}`;
}

export function normalizeProjectThemePalette(
	palette: ProjectThemePalette
): ProjectThemePalette | null {
	const entries = Object.entries(palette).map(([key, value]) => [key, normalizeThemeColor(value)]);
	if (entries.some(([, value]) => value === null)) return null;
	return Object.fromEntries(entries) as ProjectThemePalette;
}

type Rgb = { b: number; g: number; r: number };

function hexToRgb(value: string): Rgb {
	const normalized = normalizeThemeColor(value);
	if (!normalized) throw new Error(`Invalid theme color: ${value}`);
	return {
		r: Number.parseInt(normalized.slice(1, 3), 16),
		g: Number.parseInt(normalized.slice(3, 5), 16),
		b: Number.parseInt(normalized.slice(5, 7), 16),
	};
}

function channelToHex(value: number) {
	return Math.round(Math.max(0, Math.min(255, value)))
		.toString(16)
		.padStart(2, '0');
}

function rgbToHex(rgb: Rgb) {
	return `#${channelToHex(rgb.r)}${channelToHex(rgb.g)}${channelToHex(rgb.b)}`;
}

/** Mixes in linear sRGB. Percent is the contribution from `overlay`. */
export function mixThemeColors(base: string, overlay: string, percent: number): string {
	const a = hexToRgb(base);
	const b = hexToRgb(overlay);
	const amount = Math.max(0, Math.min(1, percent));
	return rgbToHex({
		r: a.r + (b.r - a.r) * amount,
		g: a.g + (b.g - a.g) * amount,
		b: a.b + (b.b - a.b) * amount,
	});
}

function relativeLuminance(value: string) {
	const rgb = hexToRgb(value);
	const linearize = (channel: number) => {
		const normalized = channel / 255;
		return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

export function themeContrastRatio(a: string, b: string) {
	const first = relativeLuminance(a);
	const second = relativeLuminance(b);
	const lighter = Math.max(first, second);
	const darker = Math.min(first, second);
	return (lighter + 0.05) / (darker + 0.05);
}

const toOklch = converter('oklch');
const PRIMARY_BUTTON_CONTRAST_MINIMUM = 3.5;

type OklchReference = { c: number; h: number; hex: string; l: number };

const KINO_BLUE = {
	blue300: { c: 0.105, h: 251.813, hex: '#8ec5ff', l: 0.809 },
	blue400: { c: 0.165, h: 254.624, hex: '#51a2ff', l: 0.707 },
	blue500: { c: 0.214, h: 259.815, hex: '#2b7fff', l: 0.623 },
	blue600: { c: 0.245, h: 262.881, hex: '#155dfc', l: 0.546 },
	blue700: { c: 0.243, h: 264.376, hex: '#1447e6', l: 0.488 },
	blue800: { c: 0.199, h: 265.638, hex: '#193cb8', l: 0.424 },
	blue900: { c: 0.146, h: 265.522, hex: '#1c398e', l: 0.379 },
	darkPrimary: { c: 0.188, h: 259.8145, hex: '#3b82f6', l: 0.6231 },
	lightPrimary: { c: 0.2152, h: 262.8809, hex: '#2563eb', l: 0.5461 },
} as const satisfies Record<string, OklchReference>;

function applyOklchReferenceTransform(value: string, base: OklchReference, target: OklchReference) {
	const normalized = normalizeThemeColor(value);
	if (normalized === base.hex) return target.hex;
	const color = toOklch(value);
	if (!color) throw new Error(`Invalid theme color: ${value}`);
	const transformed = clampRgb({
		...color,
		c: Math.max(0, color.c * (target.c / base.c)),
		h: color.h === undefined ? undefined : color.h + (target.h - base.h),
		l: Math.max(0, Math.min(1, color.l + (target.l - base.l))),
	});
	return formatHex(transformed).toLowerCase();
}

function isExactKinoButtonBase(primary: string, mode: ProjectThemeMode) {
	const reference = mode === 'dark' ? KINO_BLUE.darkPrimary : KINO_BLUE.lightPrimary;
	return normalizeThemeColor(primary) === reference.hex;
}

function ensureButtonGradientContrast(
	primary: string,
	foreground: string,
	base: OklchReference,
	minimum = PRIMARY_BUTTON_CONTRAST_MINIMUM
) {
	const normalized = normalizeThemeColor(primary);
	if (!normalized) throw new Error(`Invalid theme color: ${primary}`);
	// Kino is the visual reference and remains byte-for-byte unchanged.
	if (normalized === base.hex) return normalized;
	const passes = (candidate: string) => {
		const lighterStop = applyOklchReferenceTransform(candidate, base, KINO_BLUE.blue400);
		return (
			themeContrastRatio(foreground, candidate) >= minimum &&
			themeContrastRatio(foreground, lighterStop) >= minimum
		);
	};
	if (passes(normalized)) return normalized;
	const color = toOklch(normalized);
	if (!color) throw new Error(`Invalid theme color: ${primary}`);
	const direction =
		themeContrastRatio(foreground, '#000000') >= themeContrastRatio(foreground, '#ffffff') ? -1 : 1;
	for (let step = 1; step <= 200; step += 1) {
		const candidate = formatHex(
			clampRgb({ ...color, l: Math.max(0, Math.min(1, color.l + direction * step * 0.005)) })
		).toLowerCase();
		if (passes(candidate)) return candidate;
	}
	return direction < 0 ? '#000000' : '#ffffff';
}

export function derivePrimaryButtonPalette(
	primary: string,
	mode: ProjectThemeMode,
	foreground: string
): PrimaryButtonPalette {
	const base = mode === 'dark' ? KINO_BLUE.darkPrimary : KINO_BLUE.lightPrimary;
	const buttonPrimary = ensureButtonGradientContrast(primary, foreground, base);
	const transform = (target: OklchReference) =>
		applyOklchReferenceTransform(buttonPrimary, base, target);
	if (mode === 'dark') {
		return {
			activeBorder: transform(KINO_BLUE.blue500),
			activeFrom: transform(KINO_BLUE.blue600),
			activeTo: transform(KINO_BLUE.blue700),
			border: transform(KINO_BLUE.blue300),
			from: transform(KINO_BLUE.darkPrimary),
			hoverBorder: transform(KINO_BLUE.blue400),
			hoverTo: transform(KINO_BLUE.blue600),
			to: transform(KINO_BLUE.blue400),
		};
	}
	return {
		activeBorder: transform(KINO_BLUE.blue900),
		activeFrom: transform(KINO_BLUE.lightPrimary),
		activeTo: transform(KINO_BLUE.blue800),
		border: transform(KINO_BLUE.blue500),
		from: transform(KINO_BLUE.lightPrimary),
		hoverBorder: transform(KINO_BLUE.blue800),
		hoverTo: transform(KINO_BLUE.blue600),
		to: transform(KINO_BLUE.blue400),
	};
}

export function primaryButtonTextContrast(foreground: string, primary: string) {
	return themeContrastRatio(foreground, primary);
}

export function readablePrimaryButtonForeground(primary: string) {
	return themeContrastRatio('#ffffff', primary) >= themeContrastRatio('#000000', primary)
		? '#ffffff'
		: '#000000';
}

function contrastSafeMix(background: string, foreground: string, minimum: number) {
	for (let amount = 0.55; amount <= 1; amount += 0.025) {
		const candidate = mixThemeColors(background, foreground, amount);
		if (themeContrastRatio(candidate, background) >= minimum) return candidate;
	}
	return foreground;
}

/**
 * Version 1 derivation contract. Percentages are deliberately fixed: changing
 * them changes existing published themes and therefore requires a new version.
 */
export function deriveProjectThemeTokens(
	palette: ProjectThemePalette,
	mode: ProjectThemeMode
): ProjectThemeTokens {
	const dark = mode === 'dark';
	const secondary = mixThemeColors(palette.background, palette.foreground, dark ? 0.12 : 0.05);
	const neutralMuted = mixThemeColors(palette.background, palette.foreground, dark ? 0.02 : 0.04);
	// Keep muted surfaces neutral at a glance, with only a trace of project color.
	const muted = mixThemeColors(neutralMuted, palette.primary, dark ? 0.03 : 0.02);
	const neutralNav = dark
		? mixThemeColors(palette.background, '#000000', 0.12)
		: mixThemeColors(palette.background, palette.foreground, 0.01);
	// Navigation stays closer to the page background than even a muted surface.
	const nav = mixThemeColors(neutralNav, palette.primary, dark ? 0.02 : 0.01);
	const accent = mixThemeColors(palette.background, palette.primary, dark ? 0.2 : 0.1);
	const border = mixThemeColors(palette.background, palette.foreground, dark ? 0.28 : 0.16);
	const input = mixThemeColors(palette.background, palette.foreground, dark ? 0.42 : 0.24);
	const mutedForeground = contrastSafeMix(muted, palette.foreground, 4.5);
	const chart2 = mixThemeColors(palette.primary, dark ? '#d946ef' : '#9333ea', 0.45);
	const chart3 = mixThemeColors(palette.primary, dark ? '#2dd4bf' : '#0f766e', 0.55);
	const chart4 = mixThemeColors(palette.primary, dark ? '#fbbf24' : '#b45309', 0.55);
	const chart5 = mixThemeColors(palette.primary, dark ? '#fb7185' : '#be123c', 0.55);
	const primaryButton = derivePrimaryButtonPalette(
		palette.primary,
		mode,
		palette.primaryForeground
	);

	return {
		absolute: palette.surface,
		accent,
		'accent-foreground': palette.foreground,
		background: palette.background,
		border,
		card: palette.surface,
		'card-foreground': palette.surfaceForeground,
		'chart-1': palette.primary,
		'chart-2': chart2,
		'chart-3': chart3,
		'chart-4': chart4,
		'chart-5': chart5,
		destructive: dark ? '#e85d4a' : '#dc3f32',
		'destructive-foreground': '#ffffff',
		foreground: palette.foreground,
		input,
		'input-background': palette.surface,
		'input-readonly-background': secondary,
		muted,
		'muted-foreground': mutedForeground,
		nav,
		popover: palette.surface,
		'popover-foreground': palette.surfaceForeground,
		primary: palette.primary,
		'primary-button-active-border': primaryButton.activeBorder,
		'primary-button-active-from': primaryButton.activeFrom,
		'primary-button-active-to': primaryButton.activeTo,
		'primary-button-border': primaryButton.border,
		'primary-button-from': primaryButton.from,
		'primary-button-hover-border': primaryButton.hoverBorder,
		'primary-button-hover-to': primaryButton.hoverTo,
		'primary-button-to': primaryButton.to,
		'primary-foreground': palette.primaryForeground,
		ring: palette.primary,
		'ring-accent': contrastSafeMix(palette.background, palette.primary, 3),
		secondary,
		'secondary-foreground': palette.foreground,
		sidebar: palette.background,
		'sidebar-accent': accent,
		'sidebar-accent-foreground': palette.foreground,
		'sidebar-border': border,
		'sidebar-foreground': palette.foreground,
		'sidebar-primary': palette.primary,
		'sidebar-primary-foreground': palette.primaryForeground,
		'sidebar-ring': palette.primary,
	};
}

function validateMode(
	mode: ProjectThemeMode,
	palette: ProjectThemePalette
): Array<ProjectThemeValidationIssue> {
	const tokens = deriveProjectThemeTokens(palette, mode);
	const checks = [
		['Page text', palette.foreground, palette.background, 4.5],
		['Surface text', palette.surfaceForeground, palette.surface, 4.5],
		['Muted text', tokens['muted-foreground'], tokens.muted, 4.5],
		['Focus ring on page', tokens.ring, palette.background, 3],
		['Focus ring on surface', tokens.ring, palette.surface, 3],
	] as const;
	const issues: Array<ProjectThemeValidationIssue> = checks.flatMap(
		([label, foreground, background, minimum]) => {
			const actual = themeContrastRatio(foreground, background);
			return actual + 0.001 < minimum ? [{ actual, label, minimum, mode }] : [];
		}
	);
	const buttonContrast = Math.min(
		primaryButtonTextContrast(palette.primaryForeground, tokens['primary-button-from']),
		primaryButtonTextContrast(palette.primaryForeground, tokens['primary-button-to'])
	);
	if (
		!isExactKinoButtonBase(palette.primary, mode) &&
		buttonContrast + 0.001 < PRIMARY_BUTTON_CONTRAST_MINIMUM
	) {
		issues.push({
			actual: buttonContrast,
			label: 'Primary button text',
			minimum: PRIMARY_BUTTON_CONTRAST_MINIMUM,
			mode,
		});
	}
	return issues;
}

export function validateProjectTheme(theme: ProjectThemeInput): Array<ProjectThemeValidationIssue> {
	if (!PROJECT_THEME_PRESET_IDS.includes(theme.presetId)) {
		return [{ actual: 0, label: 'Unknown theme preset', minimum: 1, mode: 'light' }];
	}
	const light = normalizeProjectThemePalette(theme.light);
	const dark = normalizeProjectThemePalette(theme.dark);
	if (!light || !dark) {
		return [{ actual: 0, label: 'Invalid color value', minimum: 1, mode: 'light' }];
	}
	return [...validateMode('light', light), ...validateMode('dark', dark)];
}

export const PROJECT_THEME_PRESETS: Record<ProjectThemePresetId, ProjectThemeInput> = {
	kino: {
		version: 1,
		presetId: 'kino',
		light: {
			background: '#ffffff',
			foreground: '#252525',
			primary: '#2563eb',
			primaryForeground: '#ffffff',
			surface: '#fcfcfc',
			surfaceForeground: '#252525',
		},
		dark: {
			background: '#161616',
			foreground: '#ffffff',
			primary: '#3b82f6',
			primaryForeground: '#ffffff',
			surface: '#1d1d1d',
			surfaceForeground: '#fafafa',
		},
	},
	red: createProjectThemeFromAccent('#dc2626', 'red')!,
	orange: createProjectThemeFromAccent('#ea580c', 'orange')!,
	golden: {
		version: 1,
		presetId: 'golden',
		light: {
			background: '#ffffff',
			foreground: '#252525',
			primary: '#a16207',
			primaryForeground: '#ffffff',
			surface: '#fcfcfc',
			surfaceForeground: '#252525',
		},
		dark: {
			background: '#161616',
			foreground: '#ffffff',
			primary: '#ba7915',
			primaryForeground: '#ffffff',
			surface: '#1d1d1d',
			surfaceForeground: '#fafafa',
		},
	},
	forest: {
		version: 1,
		presetId: 'forest',
		light: {
			background: '#f7fbf5',
			foreground: '#18301f',
			primary: '#26734d',
			primaryForeground: '#ffffff',
			surface: '#ffffff',
			surfaceForeground: '#18301f',
		},
		dark: {
			background: '#101c14',
			foreground: '#edf8ef',
			primary: '#66d29a',
			primaryForeground: '#10251a',
			surface: '#17271c',
			surfaceForeground: '#edf8ef',
		},
	},
	teal: createProjectThemeFromAccent('#0d9488', 'teal')!,
	purple: createProjectThemeFromAccent('#7c3aed', 'purple')!,
	sunset: {
		version: 1,
		presetId: 'sunset',
		light: {
			background: '#fff9f5',
			foreground: '#3b1f24',
			primary: '#b83b5e',
			primaryForeground: '#ffffff',
			surface: '#ffffff',
			surfaceForeground: '#3b1f24',
		},
		dark: {
			background: '#241419',
			foreground: '#fff1eb',
			primary: '#fb7185',
			primaryForeground: '#321218',
			surface: '#301b21',
			surfaceForeground: '#fff1eb',
		},
	},
	monochrome: {
		version: 1,
		presetId: 'monochrome',
		light: {
			background: '#ffffff',
			foreground: '#171717',
			primary: '#262626',
			primaryForeground: '#ffffff',
			surface: '#fafafa',
			surfaceForeground: '#171717',
		},
		dark: {
			background: '#111111',
			foreground: '#f5f5f5',
			primary: '#f5f5f5',
			primaryForeground: '#171717',
			surface: '#1c1c1c',
			surfaceForeground: '#f5f5f5',
		},
	},
	custom: {
		version: 1,
		presetId: 'custom',
		light: {
			background: '#ffffff',
			foreground: '#252525',
			primary: '#2563eb',
			primaryForeground: '#ffffff',
			surface: '#fcfcfc',
			surfaceForeground: '#252525',
		},
		dark: {
			background: '#161616',
			foreground: '#ffffff',
			primary: '#3b82f6',
			primaryForeground: '#ffffff',
			surface: '#1d1d1d',
			surfaceForeground: '#fafafa',
		},
	},
};

export const PROJECT_THEME_ACCENTS: Record<ProjectThemePresetId, string> = {
	custom: '#2563eb',
	forest: '#2f855a',
	golden: '#a16207',
	kino: '#2563eb',
	monochrome: '#525252',
	orange: '#ea580c',
	purple: '#7c3aed',
	red: '#dc2626',
	sunset: '#c24167',
	teal: '#0d9488',
};

function themesMatch(left: ProjectThemeInput, right: ProjectThemeInput) {
	const colors: Array<keyof ProjectThemePalette> = [
		'background',
		'foreground',
		'primary',
		'primaryForeground',
		'surface',
		'surfaceForeground',
	];
	return (
		left.presetId === right.presetId &&
		colors.every(
			(color) => left.light[color] === right.light[color] && left.dark[color] === right.dark[color]
		)
	);
}

/** True only for a palette produced by one of the public, curated presets. */
export function isCuratedProjectTheme(theme: ProjectThemeInput) {
	if (theme.presetId === 'custom') return false;
	const storedPreset = PROJECT_THEME_PRESETS[theme.presetId];
	const generatedPreset = createProjectThemeFromAccent(
		PROJECT_THEME_ACCENTS[theme.presetId],
		theme.presetId
	);
	return (
		themesMatch(theme, storedPreset) || (!!generatedPreset && themesMatch(theme, generatedPreset))
	);
}

function ensureAccentContrast(color: string, background: string, target: string) {
	if (themeContrastRatio(color, background) >= 3) return color;
	for (let amount = 0.05; amount <= 1; amount += 0.05) {
		const candidate = mixThemeColors(color, target, amount);
		if (themeContrastRatio(candidate, background) >= 3) return candidate;
	}
	return target;
}

/** Build a restrained Kino theme from one arbitrary user-selected accent. */
export function createProjectThemeFromAccent(
	accent: string,
	presetId: ProjectThemePresetId = 'custom'
): ProjectThemeInput | null {
	const normalized = normalizeThemeColor(accent);
	if (!normalized) return null;
	const lightPrimary = ensureAccentContrast(
		ensureAccentContrast(normalized, '#ffffff', '#171717'),
		'#fcfcfc',
		'#171717'
	);
	const darkAccent = applyOklchReferenceTransform(
		lightPrimary,
		KINO_BLUE.lightPrimary,
		KINO_BLUE.darkPrimary
	);
	const darkPrimary = ensureAccentContrast(
		ensureAccentContrast(darkAccent, '#161616', '#ffffff'),
		'#1d1d1d',
		'#ffffff'
	);
	return {
		version: PROJECT_THEME_VERSION,
		presetId,
		light: {
			background: '#ffffff',
			foreground: '#252525',
			primary: lightPrimary,
			primaryForeground: '#ffffff',
			surface: '#fcfcfc',
			surfaceForeground: '#252525',
		},
		dark: {
			background: '#161616',
			foreground: '#ffffff',
			primary: darkPrimary,
			primaryForeground: '#ffffff',
			surface: '#1d1d1d',
			surfaceForeground: '#fafafa',
		},
	};
}

export const DEFAULT_PROJECT_THEME = PROJECT_THEME_PRESETS.kino;

export function projectThemeCssVariables(theme: ProjectThemeInput): Record<string, string> {
	const light = deriveProjectThemeTokens(theme.light, 'light');
	const dark = deriveProjectThemeTokens(theme.dark, 'dark');
	const variables: Record<string, string> = {};
	for (const [name, value] of Object.entries(light)) variables[`--project-light-${name}`] = value;
	for (const [name, value] of Object.entries(dark)) variables[`--project-dark-${name}`] = value;
	return variables;
}
