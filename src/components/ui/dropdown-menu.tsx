import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import { CheckIcon, ChevronRightIcon, CircleIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

function DropdownMenu({ ...props }: React.ComponentProps<typeof Menu.Root>) {
	return <Menu.Root data-slot='dropdown-menu' {...props} />;
}

function DropdownMenuPortal({ ...props }: React.ComponentProps<typeof Menu.Portal>) {
	return <Menu.Portal data-slot='dropdown-menu-portal' {...props} />;
}

function DropdownMenuTrigger({
	asChild,
	children,
	...props
}: React.ComponentProps<typeof Menu.Trigger> & {
	asChild?: boolean;
}) {
	if (asChild && React.isValidElement(children)) {
		return <Menu.Trigger data-slot='dropdown-menu-trigger' render={children} {...props} />;
	}
	return (
		<Menu.Trigger data-slot='dropdown-menu-trigger' {...props}>
			{children}
		</Menu.Trigger>
	);
}

function DropdownMenuContent({
	className,
	sideOffset = 4,
	side = 'bottom',
	align = 'start',
	...props
}: React.ComponentProps<typeof Menu.Popup> & {
	sideOffset?: number;
	side?: 'top' | 'bottom' | 'left' | 'right';
	align?: 'start' | 'center' | 'end';
}) {
	return (
		<Menu.Portal>
			<Menu.Positioner sideOffset={sideOffset} side={side} align={align} className='z-50'>
				<Menu.Popup
					data-slot='dropdown-menu-content'
					className={cn(
						'z-50 max-h-(--available-height) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-ending-style:animate-out data-ending-style:fade-out-0 data-ending-style:zoom-out-95 data-starting-style:animate-in data-starting-style:fade-in-0 data-starting-style:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
						className
					)}
					{...props}
				/>
			</Menu.Positioner>
		</Menu.Portal>
	);
}

function DropdownMenuGroup({ ...props }: React.ComponentProps<typeof Menu.Group>) {
	return <Menu.Group data-slot='dropdown-menu-group' {...props} />;
}

function DropdownMenuItem({
	className,
	inset,
	variant = 'default',
	asChild,
	children,
	...props
}: React.ComponentProps<typeof Menu.Item> & {
	inset?: boolean;
	variant?: 'default' | 'destructive';
	asChild?: boolean;
}) {
	const itemClassName = cn(
		"relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:data-[highlighted]:bg-destructive/10 data-[variant=destructive]:data-[highlighted]:text-destructive dark:data-[variant=destructive]:data-[highlighted]:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:!text-destructive",
		className
	);

	if (asChild && React.isValidElement(children)) {
		return (
			<Menu.Item
				data-slot='dropdown-menu-item'
				data-inset={inset}
				data-variant={variant}
				className={itemClassName}
				render={children}
				{...props}
			/>
		);
	}

	return (
		<Menu.Item
			data-slot='dropdown-menu-item'
			data-inset={inset}
			data-variant={variant}
			className={itemClassName}
			{...props}
		>
			{children}
		</Menu.Item>
	);
}

function DropdownMenuCheckboxItem({
	className,
	children,
	checked,
	onCheckedChange,
	...props
}: Omit<React.ComponentProps<typeof Menu.CheckboxItem>, 'checked' | 'onCheckedChange'> & {
	checked?: boolean;
	onCheckedChange?: (checked: boolean) => void;
}) {
	return (
		<Menu.CheckboxItem
			data-slot='dropdown-menu-checkbox-item'
			className={cn(
				"relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			checked={checked}
			onCheckedChange={onCheckedChange}
			{...props}
		>
			<span className='pointer-events-none absolute left-2 flex size-3.5 items-center justify-center'>
				<Menu.CheckboxItemIndicator>
					<CheckIcon className='size-4' />
				</Menu.CheckboxItemIndicator>
			</span>
			{children}
		</Menu.CheckboxItem>
	);
}

function DropdownMenuRadioGroup({ ...props }: React.ComponentProps<typeof Menu.RadioGroup>) {
	return <Menu.RadioGroup data-slot='dropdown-menu-radio-group' {...props} />;
}

function DropdownMenuRadioItem({
	className,
	children,
	...props
}: React.ComponentProps<typeof Menu.RadioItem>) {
	return (
		<Menu.RadioItem
			data-slot='dropdown-menu-radio-item'
			className={cn(
				"relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			{...props}
		>
			<span className='pointer-events-none absolute left-2 flex size-3.5 items-center justify-center'>
				<Menu.RadioItemIndicator>
					<CircleIcon className='size-2 fill-current' />
				</Menu.RadioItemIndicator>
			</span>
			{children}
		</Menu.RadioItem>
	);
}

function DropdownMenuLabel({
	className,
	inset,
	...props
}: React.ComponentProps<'div'> & {
	inset?: boolean;
}) {
	return (
		<div
			data-slot='dropdown-menu-label'
			data-inset={inset}
			className={cn('px-2 py-1.5 text-sm font-medium data-[inset]:pl-8', className)}
			{...props}
		/>
	);
}

function DropdownMenuSeparator({
	className,
	...props
}: React.ComponentProps<typeof Menu.Separator>) {
	return (
		<Menu.Separator
			data-slot='dropdown-menu-separator'
			className={cn('-mx-1 my-1 h-px bg-border', className)}
			{...props}
		/>
	);
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<'span'>) {
	return (
		<span
			data-slot='dropdown-menu-shortcut'
			className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)}
			{...props}
		/>
	);
}

function DropdownMenuSub({ ...props }: React.ComponentProps<typeof Menu.SubmenuRoot>) {
	return <Menu.SubmenuRoot data-slot='dropdown-menu-sub' {...props} />;
}

function DropdownMenuSubTrigger({
	className,
	inset,
	children,
	...props
}: React.ComponentProps<typeof Menu.SubmenuTrigger> & {
	inset?: boolean;
}) {
	return (
		<Menu.SubmenuTrigger
			data-slot='dropdown-menu-sub-trigger'
			data-inset={inset}
			className={cn(
				'flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[inset]:pl-8 data-[open]:bg-accent data-[open]:text-accent-foreground',
				className
			)}
			{...props}
		>
			{children}
			<ChevronRightIcon className='ml-auto size-4' />
		</Menu.SubmenuTrigger>
	);
}

function DropdownMenuSubContent({
	className,
	sideOffset = 2,
	...props
}: React.ComponentProps<typeof Menu.Popup> & {
	sideOffset?: number;
}) {
	return (
		<Menu.Portal>
			<Menu.Positioner sideOffset={sideOffset} side='right' align='start' className='z-50'>
				<Menu.Popup
					data-slot='dropdown-menu-sub-content'
					className={cn(
						'z-50 min-w-[8rem] origin-[var(--transform-origin)] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[ending-style]:animate-out data-[ending-style]:fade-out-0 data-[ending-style]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[starting-style]:animate-in data-[starting-style]:fade-in-0 data-[starting-style]:zoom-in-95',
						className
					)}
					{...props}
				/>
			</Menu.Positioner>
		</Menu.Portal>
	);
}

export {
	DropdownMenu,
	DropdownMenuPortal,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuItem,
	DropdownMenuCheckboxItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
};
