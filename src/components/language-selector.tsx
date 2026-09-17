import type { AppLocale } from '@convex/i18n';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Languages } from 'lucide-react';

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { useCRPC } from '@/lib/convex/crpc';
import { cn } from '@/lib/utils';
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

const LABEL_BY_VALUE = Object.fromEntries(
	LANGUAGE_OPTIONS.map((option) => [option.value, option.label])
) as Record<AppLocale, string>;

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
		<Select
			value={locale}
			disabled={isChanging}
			onValueChange={(next) => void changeLocale(next as AppLocale)}
		>
			<SelectTrigger aria-label={m.account_language()} className={cn('max-w-56', className)}>
				<Languages className='text-muted-foreground' aria-hidden='true' />
				<SelectValue>{(current) => LABEL_BY_VALUE[current as AppLocale]}</SelectValue>
			</SelectTrigger>
			<SelectContent align='end'>
				{LANGUAGE_OPTIONS.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
