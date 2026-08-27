export const APP_LOCALES = ['en-US', 'es-419', 'zh-Hans'] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'en-US';

export function isAppLocale(value: string): value is AppLocale {
	return APP_LOCALES.some((locale) => locale === value);
}
