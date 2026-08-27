import type { AppLocale } from '@convex/i18n';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Check } from 'lucide-react';

import { LANGUAGE_OPTIONS } from '@/components/language-selector';
import { useCRPC } from '@/lib/convex/crpc';
import { titleMeta } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { getLocale, setLocale } from '@/paraglide/runtime.js';

export const Route = createFileRoute('/account/language/')({
	head: () => ({ meta: [titleMeta([m.language_settings_title(), m.account_title()])] }),
	component: LanguageSettingsRoute,
});

function LanguageSettingsRoute() {
	const crpc = useCRPC();
	const updateLocale = useMutation(crpc.profile.updateLocale.mutationOptions());
	const [error, setError] = useState<string | null>(null);
	const locale = getLocale();

	const handleSelect = async (nextLocale: AppLocale) => {
		if (nextLocale === locale || updateLocale.isPending) return;
		setError(null);

		try {
			await updateLocale.mutateAsync({ locale: nextLocale });
			setLocale(nextLocale);
		} catch {
			setError(m.language_settings_error());
		}
	};

	return (
		<section className='max-w-3xl'>
			<header className='border-b pb-4'>
				<h2 className='text-xl font-semibold'>{m.language_settings_title()}</h2>
				<p className='mt-1 text-sm text-muted-foreground'>{m.language_settings_description()}</p>
			</header>

			<div className='mt-6 grid gap-4 sm:grid-cols-2'>
				{LANGUAGE_OPTIONS.map((option) => {
					const isActive = locale === option.value;

					return (
						<button
							key={option.value}
							type='button'
							aria-pressed={isActive}
							disabled={updateLocale.isPending}
							onClick={() => void handleSelect(option.value)}
							className={cn(
								'group flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-colors disabled:opacity-50 hocus:border-foreground/30',
								isActive && 'border-foreground ring-1 ring-foreground'
							)}
						>
							<div className='flex items-center justify-between'>
								<span className='font-medium'>{option.label}</span>
								{isActive ? <Check className='size-4 text-foreground' /> : null}
							</div>
							<p className='text-sm text-muted-foreground'>{option.description}</p>
						</button>
					);
				})}
			</div>

			{error ? <p className='mt-4 text-sm text-destructive'>{error}</p> : null}
		</section>
	);
}
