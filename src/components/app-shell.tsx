import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/site-footer';
import { PublicMainNav } from '@/components/site-nav/public-main-nav';
import { cn } from '@/lib/utils';

/**
 * The one page frame: nav on top, content in the middle, footer pinned to the
 * bottom. Every route layout should render through this so the header and
 * footer are never accidentally left out of a page.
 *
 * The default header is the global `MainNav`. Pass `nav` only when a layout
 * needs per-route context (org, project, sub-navigation).
 */
export function AppShell({
	nav = <PublicMainNav />,
	className,
	children,
}: {
	nav?: ReactNode;
	className?: string;
	children: ReactNode;
}) {
	return (
		<div className={cn('flex min-h-svh w-full flex-col', className)}>
			{nav}
			{children}
			<SiteFooter />
		</div>
	);
}
