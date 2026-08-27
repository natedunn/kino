import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useCRPC } from '@/lib/convex/crpc';
import { getLocale, setLocale } from '@/paraglide/runtime.js';

const ACCOUNT_LOCALE_SYNC_KEY = 'kino:account-locale-sync';

/** Keeps the request cookie aligned with an authenticated account preference. */
export function AccountLocaleSync() {
	const crpc = useCRPC();
	const profileQuery = useQuery(
		crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true, subscribe: false })
	);

	useEffect(() => {
		const accountLocale = profileQuery.data?.locale;
		if (!accountLocale) return;

		const currentLocale = getLocale();
		const transition = `${currentLocale}->${accountLocale}`;

		try {
			if (accountLocale === currentLocale) {
				sessionStorage.removeItem(ACCOUNT_LOCALE_SYNC_KEY);
				return;
			}
			if (sessionStorage.getItem(ACCOUNT_LOCALE_SYNC_KEY) === transition) return;

			// `setLocale` reloads the document. Remember this attempt so a cookie or
			// browser-policy failure cannot turn account synchronization into a reload loop.
			sessionStorage.setItem(ACCOUNT_LOCALE_SYNC_KEY, transition);
		} catch {
			// Without durable tab storage, automatic reload synchronization is unsafe.
			return;
		}

		setLocale(accountLocale);
	}, [profileQuery.data?.locale]);

	return null;
}
