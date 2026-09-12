import type { ReactNode } from 'react';

import { Link } from '@tanstack/react-router';

import { KinoMark } from '@/components/kino-mark';
import { cn } from '@/lib/utils';

/**
 * Inline "Kino™" — the product name with its trademark symbol. Use this
 * wherever the name appears as a brand (footer, brand page, legal small
 * print) rather than as a plain word in a sentence.
 */
export function KinoName({
	className,
	trademark = true,
}: {
	className?: string;
	trademark?: boolean;
}) {
	return (
		<span className={cn('font-semibold tracking-tight whitespace-nowrap', className)}>
			Kino
			{trademark ? (
				<span className='ml-px align-super text-[0.5em] font-medium text-muted-foreground'>™</span>
			) : null}
		</span>
	);
}

const SIZES = {
	sm: { box: 'size-6 rounded-[5px]', gap: 'gap-2', text: 'text-sm' },
	md: { box: 'size-8 rounded-md', gap: 'gap-2.5', text: 'text-base' },
	lg: { box: 'size-10 rounded-lg', gap: 'gap-3', text: 'text-xl' },
} as const;

type KinoBrandProps = {
	className?: string;
	size?: keyof typeof SIZES;
	/** Wrap the lockup in a link home. */
	to?: '/' | '/dashboard';
	trademark?: boolean;
};

/**
 * Logo lockup: the Kino mark next to the name. The mark keeps the same
 * treatment as the main nav (bordered tile, background-colored square) so the
 * lockup reads as the same object everywhere.
 */
export function KinoBrand({ className, size = 'md', to, trademark = true }: KinoBrandProps) {
	const s = SIZES[size];

	const content: ReactNode = (
		<>
			<span
				className={cn(
					'flex shrink-0 items-center justify-center overflow-hidden border border-foreground/15 dark:border-foreground/25',
					s.box
				)}
			>
				<KinoMark aria-hidden='true' className='h-full w-full text-background dark:text-card' />
			</span>
			<KinoName className={s.text} trademark={trademark} />
		</>
	);

	const baseClass = cn('inline-flex items-center', s.gap, className);

	if (to) {
		return (
			<Link
				to={to}
				className={cn(
					baseClass,
					'rounded-md text-foreground transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background hocus:opacity-80'
				)}
			>
				{content}
			</Link>
		);
	}

	return <span className={cn(baseClass, 'text-foreground')}>{content}</span>;
}
