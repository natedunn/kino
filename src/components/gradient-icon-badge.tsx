import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

// The blue gradient icon square used in sign-in prompts, with a soft "meshy"
// multi-radial gradient glow blurred behind it.
export function GradientIconBadge({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className='relative w-fit'>
			{/* A single-blue, wider-than-tall glow behind the square. A few
			    same-hue radial points overlap for subtle organic variation without
			    reading as multi-coloured. Elliptical (wide) rather than circular. */}
			<div
				aria-hidden
				className='pointer-events-none absolute -inset-6 rounded-full opacity-70 blur-2xl'
				style={{
					backgroundImage:
						'radial-gradient(45% 60% at 32% 42%, oklch(0.7 0.2 252) 0%, transparent 66%), ' +
						'radial-gradient(45% 60% at 68% 58%, oklch(0.6 0.22 258) 0%, transparent 66%), ' +
						'radial-gradient(55% 72% at 50% 50%, oklch(0.66 0.21 255) 0%, transparent 70%)',
				}}
			/>
			<div
				className={cn(
					'relative flex size-14 items-center justify-center rounded-2xl border border-blue-500 bg-gradient-to-tl from-primary to-blue-400 text-background shadow-lg ring-1 ring-white/25 ring-inset dark:border-blue-300 dark:text-foreground',
					className
				)}
			>
				{children}
			</div>
		</div>
	);
}
