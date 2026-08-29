import type { AppLocale } from '@convex/i18n';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { useCRPC } from '@/lib/convex/crpc';
import { m } from '@/paraglide/messages.js';
import { getLocale, setLocale } from '@/paraglide/runtime.js';

export const LANGUAGE_OPTIONS: ReadonlyArray<{
	description: string;
	label: string;
	value: AppLocale;
}> = [
	{ value: 'en-US', label: 'English (United States)', description: 'English (US)' },
	{ value: 'es-419', label: 'Español (Latinoamérica)', description: 'Spanish (Latin America)' },
	{ value: 'zh-Hans', label: '简体中文', description: 'Chinese (Simplified)' },
];

export function LanguageSelector({ className }: { className?: string }) {
	const crpc = useCRPC();
	const profileQuery = useQuery(
		crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true, subscribe: false })
	);
	const updateLocale = useMutation(crpc.profile.updateLocale.mutationOptions());
	const [isChanging, setIsChanging] = useState(false);
	const locale = getLocale();

	const changeLocale = async (nextLocale: AppLocale) => {
		if (nextLocale === locale || isChanging) return;
		setIsChanging(true);

		try {
			if (profileQuery.data) {
				await updateLocale.mutateAsync({ locale: nextLocale }).catch(() => undefined);
			}

			await setLocale(nextLocale);
		} finally {
			// Normally setLocale reloads the document. Re-enable the control if a
			// custom strategy or failed navigation leaves this document mounted.
			setIsChanging(false);
		}
	};

	return (
		<label className={className}>
			<span className='sr-only'>{m.account_language()}</span>
			<select
				aria-label={m.account_language()}
				className='h-8 max-w-56 rounded-lg border border-input bg-background px-2 text-sm text-foreground disabled:opacity-50'
				disabled={isChanging}
				onChange={(event) => void changeLocale(event.target.value as AppLocale)}
				value={locale}
			>
				{LANGUAGE_OPTIONS.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</label>
	);
}
