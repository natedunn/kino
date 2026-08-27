import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useCRPC } from '@/lib/convex/crpc';
import { getLocale, setLocale } from '@/paraglide/runtime.js';

/** Keeps the request cookie aligned with an authenticated account preference. */
export function AccountLocaleSync() {
	const crpc = useCRPC();
	const profileQuery = useQuery(
		crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true, subscribe: false })
	);

	useEffect(() => {
		const accountLocale = profileQuery.data?.locale;
		if (accountLocale && accountLocale !== getLocale()) {
			setLocale(accountLocale);
		}
	}, [profileQuery.data?.locale]);

	return null;
}
