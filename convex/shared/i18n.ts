export const APP_LOCALES = ['en-US', 'es-419', 'zh-Hans'] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'en-US';

export function isAppLocale(value: string): value is AppLocale {
	return APP_LOCALES.some((locale) => locale === value);
}

const LOCALE_COOKIE_NAME = 'PARAGLIDE_LOCALE';

export function resolveRequestLocale(request?: Request): AppLocale {
	if (!request) return DEFAULT_LOCALE;
	const cookieLocale = request.headers
		.get('cookie')
		?.split(';')
		.map((cookie) => cookie.trim())
		.find((cookie) => cookie.startsWith(`${LOCALE_COOKIE_NAME}=`))
		?.slice(LOCALE_COOKIE_NAME.length + 1);
	if (cookieLocale && isAppLocale(cookieLocale)) return cookieLocale;

	const preferences = request.headers.get('accept-language')?.split(',') ?? [];
	for (const preference of preferences) {
		const language = preference.split(';')[0]?.trim().toLowerCase();
		if (language === 'es' || language?.startsWith('es-')) return 'es-419';
		if (language === 'zh' || language?.startsWith('zh-')) return 'zh-Hans';
		if (language === 'en' || language?.startsWith('en-')) return 'en-US';
	}
	return DEFAULT_LOCALE;
}
