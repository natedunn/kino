import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';

import { cn } from '@/lib/utils';

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
	return (
		<TabsPrimitive.Root
			data-slot='tabs'
			className={cn('flex flex-col gap-2', className)}
			{...props}
		/>
	);
}

// The pill container. `relative` so the sliding indicator can position itself
// against it; tabs sit above the indicator via `z-10`. `indicatorClassName`
// themes the sliding pill (e.g. a dark active pill) without touching the list.
function TabsList({
	className,
	children,
	indicatorClassName,
	...props
}: TabsPrimitive.List.Props & { indicatorClassName?: string }) {
	return (
		<TabsPrimitive.List
			data-slot='tabs-list'
			className={cn(
				'relative inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
				className
			)}
			{...props}
		>
			{children}
			<TabsIndicator className={indicatorClassName} />
		</TabsPrimitive.List>
	);
}

// Base UI marks the active tab with `data-active` (there is no `data-selected`).
// Inactive tabs pick up a foreground text + subtle bg on hover; the hover is
// scoped to non-active so it never fights the active tab's own styling (e.g. a
// caller that themes the active label onto a dark indicator pill).
function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
	return (
		<TabsPrimitive.Tab
			data-slot='tabs-trigger'
			className={cn(
				"z-10 inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none select-none data-active:text-foreground not-data-active:hover:bg-foreground/10 not-data-active:hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
				className
			)}
			{...props}
		/>
	);
}

// The sliding pill behind the active tab. Base UI reports the active tab's
// position/size via the `--active-tab-*` CSS vars; we translate and size the
// indicator from them so it animates between tabs.
function TabsIndicator({ className, ...props }: TabsPrimitive.Indicator.Props) {
	return (
		<TabsPrimitive.Indicator
			data-slot='tabs-indicator'
			renderBeforeHydration
			className={cn(
				'absolute top-1/2 left-0 z-0 h-[calc(var(--active-tab-height)-0.25rem)] w-(--active-tab-width) -translate-y-1/2 translate-x-(--active-tab-left) rounded-md bg-background shadow-sm ring-1 ring-foreground/5 transition-[translate,width] duration-200 ease-out',
				className
			)}
			{...props}
		/>
	);
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
	return (
		<TabsPrimitive.Panel
			data-slot='tabs-content'
			className={cn('flex-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50', className)}
			{...props}
		/>
	);
}

export { Tabs, TabsList, TabsTrigger, TabsContent, TabsIndicator };
