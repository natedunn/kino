import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Shared scaffolding for the public marketing pages (/about, /pricing,
 * /contact, /brand). Mirrors the landing page rhythm: left-aligned hero in the
 * container, then full-width sections separated by hairlines.
 */
export function MarketingPage({
	title,
	description,
	children,
}: {
	title: ReactNode;
	description: string;
	children: ReactNode;
}) {
	return (
		<article className='flex flex-1 flex-col'>
			<header className='container py-16 md:py-24'>
				<div className='max-w-2xl'>
					<h1 className='text-4xl font-bold tracking-tight md:text-5xl'>{title}</h1>
					<p className='mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground'>
						{description}
					</p>
				</div>
			</header>
			{children}
		</article>
	);
}

export function MarketingSection({
	id,
	title,
	description,
	children,
	className,
}: {
	id?: string;
	title?: string;
	description?: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section id={id} className={cn('border-t border-border/50', className)}>
			<div className='container py-16 md:py-20'>
				{title ? (
					<div className='max-w-xl'>
						<h2 className='text-2xl font-bold tracking-tight'>{title}</h2>
						{description ? <p className='mt-2 text-muted-foreground'>{description}</p> : null}
					</div>
				) : null}
				<div className={cn(title && 'mt-8')}>{children}</div>
			</div>
		</section>
	);
}

/**
 * The bordered, gap-px card grid used on the landing page. Cells sit on
 * `bg-border` so the hairlines between them come from the gap.
 */
export function CellGrid({
	children,
	className,
	columns = 3,
}: {
	children: ReactNode;
	className?: string;
	columns?: 2 | 3 | 4;
}) {
	return (
		<div
			className={cn(
				'grid gap-px overflow-hidden rounded-lg border border-border bg-border',
				columns === 4
					? 'sm:grid-cols-2 lg:grid-cols-4'
					: columns === 3
						? 'md:grid-cols-3'
						: 'md:grid-cols-2',
				className
			)}
		>
			{children}
		</div>
	);
}

export function Cell({
	icon,
	title,
	description,
	children,
	className,
}: {
	icon?: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	children?: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn('flex flex-col bg-card p-8 md:p-10', className)}>
			<div className='flex items-center gap-2.5 text-foreground'>
				{icon}
				<h3 className='font-semibold'>{title}</h3>
			</div>
			{description ? (
				<p className='mt-3 text-sm leading-relaxed text-muted-foreground'>{description}</p>
			) : null}
			{children}
		</div>
	);
}

/** Small uppercase tag for "coming soon" states on marketing surfaces. */
export function SoonTag({ children = 'Coming soon' }: { children?: ReactNode }) {
	return (
		<span className='inline-flex items-center rounded-sm border border-border px-1.5 py-0.5 text-[10px] leading-none font-medium tracking-wide text-muted-foreground uppercase'>
			{children}
		</span>
	);
}
