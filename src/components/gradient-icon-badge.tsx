import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

// The primary gradient icon square used in sign-in prompts, with a soft
// same-hue "meshy" glow blurred behind it.
export function GradientIconBadge({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className='relative w-fit'>
			{/* A single-hue, wider-than-tall glow behind the square. A few
			    same-hue radial points overlap for subtle organic variation without
			    reading as multi-coloured. Elliptical (wide) rather than circular. */}
			<div
				aria-hidden
				className='pointer-events-none absolute -inset-6 rounded-full opacity-70 blur-2xl'
				style={{
					backgroundImage:
						'radial-gradient(45% 60% at 32% 42%, var(--primary-button-to) 0%, transparent 66%), ' +
						'radial-gradient(45% 60% at 68% 58%, var(--primary-button-from) 0%, transparent 66%), ' +
						'radial-gradient(55% 72% at 50% 50%, var(--primary-button-border) 0%, transparent 70%)',
				}}
			/>
			<div
				className={cn(
					'relative flex size-14 items-center justify-center rounded-2xl border border-[var(--primary-button-border)] bg-gradient-to-tl from-[var(--primary-button-from)] to-[var(--primary-button-to)] text-primary-foreground shadow-lg ring-1 ring-white/25 ring-inset',
					className
				)}
			>
				{children}
			</div>
		</div>
	);
}
