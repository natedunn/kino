import type { AppLocale } from '@convex/i18n';

import { APP_LOCALES, DEFAULT_LOCALE, isAppLocale } from '@convex/i18n';

export { APP_LOCALES, DEFAULT_LOCALE, isAppLocale };
export type { AppLocale };
export const LOCALE_COOKIE_NAME = 'PARAGLIDE_LOCALE';

export function readLocaleCookie(cookieHeader: string | null | undefined): AppLocale | undefined {
	const value = cookieHeader
		?.split(';')
		.map((cookie) => cookie.trim())
		.find((cookie) => cookie.startsWith(`${LOCALE_COOKIE_NAME}=`))
		?.slice(LOCALE_COOKIE_NAME.length + 1);

	return value && isAppLocale(value) ? value : undefined;
}

const SPANISH_REGION_CODES = new Set([
	'AR',
	'BO',
	'CL',
	'CO',
	'CR',
	'CU',
	'DO',
	'EC',
	'GT',
	'HN',
	'MX',
	'NI',
	'PA',
	'PE',
	'PR',
	'PY',
	'SV',
	'UY',
	'VE',
]);
const CHINESE_REGION_CODES = new Set(['CN', 'HK', 'MO', 'SG', 'TW']);
const ENGLISH_REGION_CODES = new Set(['AU', 'CA', 'GB', 'IE', 'NZ', 'US']);

export function resolveRegionLocale(countryCode: string | null | undefined): AppLocale | undefined {
	const country = countryCode?.trim().toUpperCase();
	if (!country) return undefined;
	if (SPANISH_REGION_CODES.has(country)) return 'es-419';
	if (CHINESE_REGION_CODES.has(country)) return 'zh-Hans';
	if (ENGLISH_REGION_CODES.has(country)) return 'en-US';
	return undefined;
}

export function getRequestCountry(request: Request | undefined): string | undefined {
	if (!request) return undefined;
	const cloudflareCountry = (request as Request & { cf?: { country?: unknown } }).cf?.country;
	if (typeof cloudflareCountry === 'string') return cloudflareCountry;
	return request.headers.get('cf-ipcountry') ?? undefined;
}

/** Normalizes region/browser detection to a canonical locale before Paraglide resolves it. */
export function withDetectedLocalePreference(request: Request): Request {
	const locale =
		resolveRegionLocale(getRequestCountry(request)) ??
		resolvePreferredLocale(request.headers.get('accept-language'));
	const headers = new Headers(request.headers);
	headers.set('accept-language', locale);
	return new Request(request, { headers });
}

/** Maps supported language families to the closest catalog Kino ships today. */
export function resolveAppLocale(languageTag: string | null | undefined): AppLocale {
	if (!languageTag) return DEFAULT_LOCALE;

	const normalized = languageTag.trim().replaceAll('_', '-').toLowerCase();
	if (normalized === 'es' || normalized.startsWith('es-')) return 'es-419';
	if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zh-Hans';
	if (normalized === 'en' || normalized.startsWith('en-')) return 'en-US';

	return DEFAULT_LOCALE;
}

export function resolvePreferredLocale(header: string | null | undefined): AppLocale {
	if (!header) return DEFAULT_LOCALE;

	const preferences = header
		.split(',')
		.map((entry) => {
			const [tag = '', ...parameters] = entry.trim().split(';');
			const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith('q='));
			const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;
			return { tag, quality: Number.isFinite(quality) ? quality : 0 };
		})
		.filter(({ tag, quality }) => tag !== '*' && tag !== '' && quality > 0)
		.sort((a, b) => b.quality - a.quality);

	for (const { tag } of preferences) {
		const primaryLanguage = tag.toLowerCase().split('-')[0];
		if (primaryLanguage === 'en' || primaryLanguage === 'es' || primaryLanguage === 'zh') {
			return resolveAppLocale(tag);
		}
	}

	return DEFAULT_LOCALE;
}
