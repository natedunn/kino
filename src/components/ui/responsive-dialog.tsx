import * as React from 'react';
import { XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';
import * as m from '@/paraglide/messages.js';

// A responsive overlay that renders a centered Dialog on desktop and a
// bottom-anchored Drawer (slides up from the bottom, swipe down to dismiss) on
// mobile. Each part reads the shared context and renders the matching
// primitive, so callers use one consistent API regardless of viewport. The
// mobile/desktop decision comes from `useIsMobile`, which is `false` until
// mounted — matching SSR — so the tree only swaps to the Drawer after hydration
// on small screens.
const ResponsiveDialogContext = React.createContext<{ isMobile: boolean } | null>(null);

function useResponsiveDialog() {
	const context = React.useContext(ResponsiveDialogContext);
	if (!context) {
		throw new Error('ResponsiveDialog parts must be used within a <ResponsiveDialog>.');
	}
	return context;
}

function ResponsiveDialog({ children, ...props }: React.ComponentProps<typeof Dialog>) {
	const isMobile = useIsMobile();
	const contextValue = React.useMemo(() => ({ isMobile }), [isMobile]);

	return (
		<ResponsiveDialogContext.Provider value={contextValue}>
			{isMobile ? (
				<Drawer showSwipeHandle swipeDirection='down' {...props}>
					{children}
				</Drawer>
			) : (
				<Dialog {...props}>{children}</Dialog>
			)}
		</ResponsiveDialogContext.Provider>
	);
}

function ResponsiveDialogTrigger(props: React.ComponentProps<typeof DialogTrigger>) {
	const { isMobile } = useResponsiveDialog();
	return isMobile ? <DrawerTrigger {...props} /> : <DialogTrigger {...props} />;
}

function ResponsiveDialogClose(props: React.ComponentProps<typeof DialogClose>) {
	const { isMobile } = useResponsiveDialog();
	return isMobile ? <DrawerClose {...props} /> : <DialogClose {...props} />;
}

// The glossy, semi-translucent frame that wraps the content card. It's partly
// see-through (backdrop shows faintly through it) with a top-down highlight
// gradient for the glass sheen; `p-1.5` is the visible ring thickness. Tuned for
// light and dark. The base popup's own bg/border/padding/radius are overridden
// here so only the ring shows.
export const RESPONSIVE_DIALOG_RING =
	'flex flex-col rounded-[1.5rem] border-0 bg-transparent bg-gradient-to-b from-white/40 to-white/12 p-1.5 shadow-2xl ring-1 ring-inset ring-white/45 backdrop-blur-md dark:from-white/7 dark:to-white/[0.025] dark:ring-white/7';

// The opaque card that sits inside the ring; the caller's `className` styles
// this (bg, padding, layout) and can override the default background.
export const RESPONSIVE_DIALOG_CARD =
	'relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[1.1rem] border border-[oklch(0.86_0_0)] bg-background shadow-md dark:border-[oklch(0.36_0_0)]';

function ResponsiveDialogContent({
	children,
	className,
	dialogClassName,
	drawerClassName,
	...props
}: Omit<React.ComponentProps<typeof DialogContent>, 'className'> & {
	// `className` styles the inner card (bg, padding, layout). Use
	// `dialogClassName`/`drawerClassName` for viewport-specific framing of the
	// outer ring (e.g. desktop max-width vs. drawer height).
	className?: string;
	dialogClassName?: string;
	drawerClassName?: string;
}) {
	const { isMobile } = useResponsiveDialog();
	const card = <div className={cn(RESPONSIVE_DIALOG_CARD, className)}>{children}</div>;

	if (isMobile) {
		return (
			<DrawerContent
				// Float the drawer off the screen edges (matches the other app drawers).
				// `--drawer-inset` is the margin; `--bleed:0px` stops the drawer's
				// overscroll bleed from filling that inset gap. The base drawer only
				// rounds its leading edge (rounded-t-xl for a bottom sheet), so round
				// the top to match the ring now that it floats on all sides. The base
				// grab handle pins to the content edge (items-end); center it in the
				// ring's top gap instead so it isn't flush with the inner card.
				//
				// `DrawerContent` wraps children in an inner element that clips with
				// `rounded-[inherit] overflow-hidden`. With our padded ring + nested
				// card that becomes a second clip layer at a mismatched radius (the
				// ring's 1.5rem inherited onto a 6px-inset element), shaving the
				// card's corners. Neutralize it so the inner card is the sole rounder.
				className={cn(
					RESPONSIVE_DIALOG_RING,
					// Flatten the glass sheen on mobile: in dark mode the drawer's ring
					// fill is a uniform 0.025 (matches the `to` stop) instead of the
					// top-heavy gradient used on desktop.
					'[--bleed:0px] [--drawer-inset:0.5rem] *:data-[slot=drawer-content]:overflow-visible *:data-[slot=drawer-swipe-handle]:items-center *:data-[slot=drawer-swipe-handle]:after:-translate-y-0.5 data-[swipe-direction=down]:rounded-t-[1.5rem] dark:from-white/[0.025]',
					drawerClassName
				)}
			>
				{card}
			</DrawerContent>
		);
	}

	return (
		<DialogContent className={cn(RESPONSIVE_DIALOG_RING, dialogClassName)} {...props}>
			{card}
		</DialogContent>
	);
}

// Standardized header. Pass `title` (plus optional `icon`/`subtitle`) for the
// common icon-chip + title + subtitle bar, or omit them and pass `children` for
// a fully custom header. A close button is included by default (`showClose`),
// so it stays consistent across the dialog and the drawer.
function ResponsiveDialogHeader({
	children,
	className,
	icon,
	showClose = true,
	subtitle,
	title,
	...props
}: Omit<React.ComponentProps<typeof DialogHeader>, 'title'> & {
	icon?: React.ReactNode;
	showClose?: boolean;
	subtitle?: React.ReactNode;
	title?: React.ReactNode;
}) {
	const { isMobile } = useResponsiveDialog();
	const Wrapper = isMobile ? DrawerHeader : DialogHeader;

	return (
		<Wrapper
			className={cn(
				'flex-row items-center justify-between gap-2 border-b bg-accent px-5 py-3 md:py-4',
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
							<ResponsiveDialogTitle className='text-sm font-semibold tracking-tight'>
								{title}
							</ResponsiveDialogTitle>
							{subtitle == null ? null : (
								<ResponsiveDialogDescription className='mt-0.5 line-clamp-1 text-xs'>
									{subtitle}
								</ResponsiveDialogDescription>
							)}
						</div>
					</div>
				)}
			</div>
			{showClose ? (
				<ResponsiveDialogClose
					render={<Button className='-mr-1.5' size='icon-sm' variant='ghost' />}
				>
					<XIcon className='size-4' />
					<span className='sr-only'>{m.common_close()}</span>
				</ResponsiveDialogClose>
			) : null}
		</Wrapper>
	);
}

// Scrollable content region between the header and footer. The card uses `p-0`,
// so the body owns its own padding on every viewport.
function ResponsiveDialogBody({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-3 md:py-4', className)} {...props} />
	);
}

// Standardized action bar — a slot, not prop-driven. Drop buttons in and lay
// them out (defaults to right-aligned; pass `className='justify-between'` for a
// split layout with a leading action).
function ResponsiveDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
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

function ResponsiveDialogTitle(props: React.ComponentProps<typeof DialogTitle>) {
	const { isMobile } = useResponsiveDialog();
	return isMobile ? <DrawerTitle {...props} /> : <DialogTitle {...props} />;
}

function ResponsiveDialogDescription(props: React.ComponentProps<typeof DialogDescription>) {
	const { isMobile } = useResponsiveDialog();
	return isMobile ? <DrawerDescription {...props} /> : <DialogDescription {...props} />;
}

export {
	ResponsiveDialog,
	ResponsiveDialogBody,
	ResponsiveDialogClose,
	ResponsiveDialogContent,
	ResponsiveDialogDescription,
	ResponsiveDialogFooter,
	ResponsiveDialogHeader,
	ResponsiveDialogTitle,
	ResponsiveDialogTrigger,
};
