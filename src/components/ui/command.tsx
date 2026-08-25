import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { CheckIcon, SearchIcon } from 'lucide-react';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';
import { RESPONSIVE_DIALOG_CARD, RESPONSIVE_DIALOG_RING } from '@/components/ui/responsive-dialog';
import { cn } from '@/lib/utils';

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
	return (
		<CommandPrimitive
			data-slot='command'
			className={cn(
				'relative flex size-full min-h-0 flex-col overflow-hidden rounded-[1.1rem]! bg-popover p-1.5 text-popover-foreground sm:p-2',
				className
			)}
			{...props}
		/>
	);
}

function CommandDialog({
	title = 'Command Palette',
	description = 'Search for a command to run...',
	children,
	className,
	initialFocus,
	commandValue,
	onCommandValueChange,
	showCloseButton = false,
	shouldFilter,
	...props
}: Omit<React.ComponentProps<typeof Dialog>, 'children'> & {
	title?: string;
	description?: string;
	className?: string;
	initialFocus?: React.ComponentProps<typeof DialogContent>['initialFocus'];
	commandValue?: string;
	onCommandValueChange?: (value: string) => void;
	showCloseButton?: boolean;
	shouldFilter?: React.ComponentProps<typeof CommandPrimitive>['shouldFilter'];
	children: React.ReactNode;
}) {
	return (
		<Dialog {...props}>
			<DialogHeader className='sr-only'>
				<DialogTitle>{title}</DialogTitle>
				<DialogDescription>{description}</DialogDescription>
			</DialogHeader>
			<DialogContent
				className={cn(
					RESPONSIVE_DIALOG_RING,
					'top-2 max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-none -translate-x-1/2 translate-y-0 duration-100 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 sm:top-[12vh] sm:max-h-[min(44rem,calc(100dvh-4rem))] sm:w-[min(38rem,calc(100%-2rem))] sm:max-w-none',
					className
				)}
				initialFocus={initialFocus}
				overlayClassName='duration-100'
				showCloseButton={showCloseButton}
			>
				<div className={cn(RESPONSIVE_DIALOG_CARD, 'bg-popover/95')}>
					<Command
						className='bg-transparent p-0 sm:p-0'
						onValueChange={onCommandValueChange}
						shouldFilter={shouldFilter}
						value={commandValue}
					>
						{children}
					</Command>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function CommandInput({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
	return (
		<div
			data-slot='command-input-wrapper'
			className='p-1 pb-1.5 in-data-[slot=dialog-content]:p-2.5 in-data-[slot=dialog-content]:pb-0 sm:p-1 sm:pb-2 sm:in-data-[slot=dialog-content]:p-3 sm:in-data-[slot=dialog-content]:pb-0'
		>
			<InputGroup className='h-11! rounded-xl! border-input/50 bg-input/40 shadow-inner *:data-[slot=input-group-addon]:pl-3! sm:h-12! sm:*:data-[slot=input-group-addon]:pl-3.5!'>
				<CommandPrimitive.Input
					data-slot='command-input'
					className={cn(
						'w-full text-base font-medium tracking-tight outline-hidden placeholder:font-normal placeholder:text-muted-foreground/55 disabled:cursor-not-allowed disabled:opacity-50 sm:text-[0.9375rem]',
						className
					)}
					{...props}
				/>
				<InputGroupAddon>
					<SearchIcon className='size-4 shrink-0 opacity-55' />
				</InputGroupAddon>
			</InputGroup>
		</div>
	);
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
	return (
		<CommandPrimitive.List
			data-slot='command-list'
			className={cn(
				'no-scrollbar max-h-[min(60dvh,28rem)] scroll-py-2 overflow-x-hidden overflow-y-auto outline-none in-data-[slot=dialog-content]:pt-3 sm:max-h-[26rem] sm:in-data-[slot=dialog-content]:pt-4',
				className
			)}
			{...props}
		/>
	);
}

function CommandEmpty({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
	return (
		<CommandPrimitive.Empty
			data-slot='command-empty'
			className={cn('py-12 text-center text-base text-muted-foreground', className)}
			{...props}
		/>
	);
}

function CommandGroup({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
	return (
		<CommandPrimitive.Group
			data-slot='command-group'
			className={cn(
				'overflow-hidden p-1 text-foreground sm:p-1.5 [&_[cmdk-group-items]]:space-y-1 **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:tracking-wide **:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:uppercase sm:**:[[cmdk-group-heading]]:text-[0.75rem]',
				className
			)}
			{...props}
		/>
	);
}

function CommandSeparator({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
	return (
		<CommandPrimitive.Separator
			data-slot='command-separator'
			className={cn('-mx-1.5 h-px bg-border/70 sm:-mx-2', className)}
			{...props}
		/>
	);
}

function CommandItem({
	className,
	children,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
	return (
		<CommandPrimitive.Item
			data-slot='command-item'
			className={cn(
				"group/command-item relative flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.9rem] outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-primary/10 data-[selected=true]:text-foreground data-[selected=true]:shadow-sm data-[selected=true]:ring-1 data-[selected=true]:ring-primary/25 sm:px-3 sm:py-2.5 dark:data-[selected=true]:bg-foreground/12 dark:data-[selected=true]:ring-foreground/20 hocus:bg-primary/10 hocus:text-foreground hocus:ring-1 hocus:ring-primary/25 dark:hocus:bg-foreground/12 dark:hocus:ring-foreground/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[selected=true]:*:[svg]:text-primary dark:data-[selected=true]:*:[svg]:text-foreground",
				className
			)}
			{...props}
		>
			{children}
			<CheckIcon className='ml-auto hidden group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:block' />
		</CommandPrimitive.Item>
	);
}

function CommandShortcut({ className, ...props }: React.ComponentProps<'span'>) {
	return (
		<span
			data-slot='command-shortcut'
			className={cn(
				'ml-auto inline-flex min-w-7 items-center justify-center rounded-md border border-border/70 bg-muted/70 px-1.5 py-0.5 font-sans text-xs font-medium text-muted-foreground/75 group-data-[selected=true]/command-item:text-muted-foreground/90 sm:min-w-8 sm:px-2',
				className
			)}
			{...props}
		/>
	);
}

export {
	Command,
	CommandDialog,
	CommandInput,
	CommandList,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandShortcut,
	CommandSeparator,
};
