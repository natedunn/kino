import * as React from 'react';
import { XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from '@/components/ui/drawer';
import { RESPONSIVE_DIALOG_CARD, RESPONSIVE_DIALOG_RING } from '@/components/ui/responsive-dialog';
import { useIsBelow } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';
import * as m from '@/paraglide/messages.js';

// A drawer that slides in from the right on ≥640px and up from the bottom on
// phones (<640px). Styled like `ResponsiveDialog` (the glass ring + card). The
// grab handle only shows on the bottom-sheet (phone) variant — the side variant
// has none.
function ResponsiveSideDrawer({ children, ...props }: React.ComponentProps<typeof Drawer>) {
	const isPhone = useIsBelow(640);

	return (
		<Drawer
			showSwipeHandle={isPhone}
			// Phone bottom-sheet gets snap stops: opens at 60%, drag up to full. The
			// right-side (tablet) drawer is full-height already, so no snap points.
			snapPoints={isPhone ? [0.6, 1] : undefined}
			swipeDirection={isPhone ? 'down' : 'right'}
			{...props}
		>
			{children}
		</Drawer>
	);
}

function ResponsiveSideDrawerTrigger(props: React.ComponentProps<typeof DrawerTrigger>) {
	return <DrawerTrigger {...props} />;
}

function ResponsiveSideDrawerClose(props: React.ComponentProps<typeof DrawerClose>) {
	return <DrawerClose {...props} />;
}

function ResponsiveSideDrawerContent({
	children,
	className,
	drawerClassName,
	...props
}: React.ComponentProps<typeof DrawerContent> & { drawerClassName?: string }) {
	return (
		<DrawerContent
			className={cn(
				RESPONSIVE_DIALOG_RING,
				// Float off the edges + round the leading edge to match the ring, for
				// both the bottom (down) and side (right) variants. `--bleed:0px`
				// stops the overscroll bleed from filling the inset gap.
				'[--bleed:0px] [--drawer-inset:0.5rem] *:data-[slot=drawer-content]:overflow-visible *:data-[slot=drawer-swipe-handle]:items-center *:data-[slot=drawer-swipe-handle]:after:-translate-y-0.5 data-[swipe-direction=down]:rounded-t-[1.5rem] data-[swipe-direction=right]:rounded-l-[1.5rem] dark:from-white/[0.025]',
				drawerClassName
			)}
			{...props}
		>
			<div className={cn(RESPONSIVE_DIALOG_CARD, className)}>{children}</div>
		</DrawerContent>
	);
}

function ResponsiveSideDrawerHeader({
	children,
	className,
	icon,
	showClose = true,
	subtitle,
	title,
	...props
}: Omit<React.ComponentProps<typeof DrawerHeader>, 'title'> & {
	icon?: React.ReactNode;
	showClose?: boolean;
	subtitle?: React.ReactNode;
	title?: React.ReactNode;
}) {
	return (
		<DrawerHeader
			className={cn(
				'flex-row items-center justify-between gap-2 border-b bg-accent px-5 py-4',
				className
			)}
			{...props}
		>
			<div className='min-w-0 flex-1'>
				{title == null ? (
					children
				) : (
					<div className='flex items-center gap-2.5 text-left'>
						{icon == null ? null : (
							<span className='flex size-7 shrink-0 items-center justify-center rounded-md border bg-background text-foreground shadow-xs [&_svg]:size-3.5'>
								{icon}
							</span>
						)}
						<div className='min-w-0 flex-1'>
							<DrawerTitle className='text-sm font-semibold tracking-tight'>{title}</DrawerTitle>
							{subtitle == null ? null : (
								<DrawerDescription className='mt-0.5 line-clamp-1 text-xs'>
									{subtitle}
								</DrawerDescription>
							)}
						</div>
					</div>
				)}
			</div>
			{showClose ? (
				<DrawerClose render={<Button className='-mr-1.5' size='icon-sm' variant='ghost' />}>
					<XIcon className='size-4' />
					<span className='sr-only'>{m.common_close()}</span>
				</DrawerClose>
			) : null}
		</DrawerHeader>
	);
}

// Scrollable content region between header and footer. The card is `p-0`, so the
// body owns its own padding.
function ResponsiveSideDrawerBody({ className, ...props }: React.ComponentProps<'div'>) {
	return <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', className)} {...props} />;
}

function ResponsiveSideDrawerFooter({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			className={cn(
				'flex items-center justify-end gap-2 border-t bg-muted/40 px-5 py-3',
				className
			)}
			{...props}
		/>
	);
}

export {
	ResponsiveSideDrawer,
	ResponsiveSideDrawerBody,
	ResponsiveSideDrawerClose,
	ResponsiveSideDrawerContent,
	ResponsiveSideDrawerFooter,
	ResponsiveSideDrawerHeader,
	ResponsiveSideDrawerTrigger,
};
