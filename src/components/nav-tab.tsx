import type { Icon } from '@/icons/types';

import { cn } from '@/lib/utils';

/**
 * Shared styling for a tab-style navigation link: icon + label with a bottom
 * border that marks the active tab. Used by the project navigation and by the
 * updates category tabs so both stay visually identical.
 *
 * Only the inner presentation lives here — each caller owns its own `Link`
 * (they derive "active" differently: route matching vs. a search param) and
 * should apply `navTabLinkClassName` to it, including the `group` class the
 * icon's hover state depends on.
 */
export const navTabLinkClassName =
	'group flex shrink-0 items-center gap-2 rounded-t-md outline-none focus-visible:bg-primary/20 focus-visible:ring-1 focus-visible:ring-primary/80 focus-visible:ring-inset';

export function NavTab({
	className,
	icon,
	isActive,
	label,
}: {
	className?: string;
	icon?: Icon | string;
	isActive: boolean;
	label: string;
}) {
	const TabIcon = icon;

	return (
		<span
			className={cn(
				'inline-flex items-center gap-2 border-b-2 px-3 pt-2 pb-2 text-xs text-muted-foreground transition-colors md:text-sm',
				isActive
					? 'border-primary text-foreground'
					: 'border-transparent hocus:border-foreground/35 hocus:text-foreground',
				className
			)}
		>
			{typeof TabIcon === 'string' ? (
				<>{TabIcon}</>
			) : (
				TabIcon && (
					<TabIcon
						className={cn(
							'size-4',
							isActive ? 'text-primary' : 'text-muted-foreground group-hocus:text-foreground'
						)}
					/>
				)
			)}
			<span>{label}</span>
		</span>
	);
}
