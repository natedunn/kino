import { defineCustomClientStrategy, defineCustomServerStrategy } from '@/paraglide/runtime.js';

import {
	getRequestCountry,
	LOCALE_COOKIE_NAME,
	readLocaleCookie,
	resolvePreferredLocale,
	resolveRegionLocale,
} from './locale';

defineCustomServerStrategy('custom-kino-locale', {
	getLocale(request) {
		return (
			readLocaleCookie(request?.headers.get('cookie')) ??
			resolveRegionLocale(getRequestCountry(request)) ??
			resolvePreferredLocale(request?.headers.get('accept-language'))
		);
	},
});

if (typeof navigator !== 'undefined' && typeof document !== 'undefined') {
	defineCustomClientStrategy('custom-kino-locale', {
		getLocale() {
			return (
				readLocaleCookie(document.cookie) ?? resolvePreferredLocale(navigator.languages.join(','))
			);
		},
		setLocale(locale) {
			document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=34560000; SameSite=Lax`;
		},
	});
}
