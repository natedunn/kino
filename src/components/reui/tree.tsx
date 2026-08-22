import type { ItemInstance } from '@headless-tree/core';

import { createContext, useContext } from 'react';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { ChevronDownIcon, MinusIcon, PlusIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type ToggleIconType = 'chevron' | 'plus-minus';

interface TreeContextValue<T = any> {
	indent: number;
	indentGuides?: boolean;
	currentItem?: ItemInstance<T>;
	tree?: any;
	toggleIconType?: ToggleIconType;
}

const TreeContext = createContext<TreeContextValue>({
	indent: 20,
	currentItem: undefined,
	tree: undefined,
	toggleIconType: 'plus-minus',
});

function useTreeContext<T = any>() {
	return useContext(TreeContext) as TreeContextValue<T>;
}

interface TreeProps extends React.HTMLAttributes<HTMLDivElement> {
	indent?: number;
	indentGuides?: boolean;
	tree?: any;
	toggleIconType?: ToggleIconType;
}

function Tree({
	indent = 20,
	indentGuides = false,
	tree,
	className,
	toggleIconType = 'chevron',
	...props
}: TreeProps) {
	const containerProps =
		tree && typeof tree.getContainerProps === 'function' ? tree.getContainerProps() : {};
	const mergedProps = { ...props, ...containerProps };

	// Extract style from mergedProps to merge with our custom styles
	const { style: propStyle, ...otherProps } = mergedProps;

	// Merge styles
	const mergedStyle = {
		...propStyle,
		'--tree-indent': `${indent}px`,
	} as React.CSSProperties;

	return (
		<TreeContext.Provider value={{ indent, indentGuides, tree, toggleIconType }}>
			<div
				data-slot='tree'
				style={mergedStyle}
				className={cn('flex flex-col', className)}
				{...otherProps}
			/>
		</TreeContext.Provider>
	);
}

interface TreeItemProps<T = any> extends Omit<useRender.ComponentProps<'button'>, 'indent'> {
	item: ItemInstance<T>;
	indent?: number;
}

function TreeItem<T = any>({ item, className, render, children, ...props }: TreeItemProps<T>) {
	const parentContext = useTreeContext<T>();
	const { indent, indentGuides } = parentContext;
	const level = item.getItemMeta().level;

	const itemProps = typeof item.getProps === 'function' ? item.getProps() : {};
	const mergedProps = {
		...props,
		...itemProps,
		children: (
			<>
				{indentGuides && level > 0 ? (
					<span aria-hidden className='pointer-events-none absolute -inset-y-0.5 left-0'>
						{Array.from({ length: level }, (_, index) => (
							<span
								className='absolute inset-y-0 w-px bg-border/60'
								key={index}
								style={{ left: `${index * indent + indent / 2}px` }}
							/>
						))}
					</span>
				) : null}
				{children}
			</>
		),
	};

	// Extract style from mergedProps to merge with our custom styles
	const { style: propStyle, ...otherProps } = mergedProps;

	// Merge styles
	const mergedStyle = {
		...propStyle,
		'--tree-padding': `${level * indent}px`,
	} as React.CSSProperties;

	const defaultProps = {
		'data-slot': 'tree-item',
		style: mergedStyle,
		className: cn(
			'relative z-10 ps-(--tree-padding) outline-hidden select-none not-last:pb-0.5 focus:z-20 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
			className
		),
		'data-focus': typeof item.isFocused === 'function' ? item.isFocused() || false : undefined,
		'data-folder': typeof item.isFolder === 'function' ? item.isFolder() || false : undefined,
		'data-selected': typeof item.isSelected === 'function' ? item.isSelected() || false : undefined,
		'data-drag-target':
			typeof item.isDragTarget === 'function' ? item.isDragTarget() || false : undefined,
		'data-search-match':
			typeof item.isMatchingSearch === 'function' ? item.isMatchingSearch() || false : undefined,
		'aria-expanded': item.isExpanded(),
	};

	return (
		<TreeContext.Provider value={{ ...parentContext, currentItem: item }}>
			{useRender({
				defaultTagName: 'button',
				render,
				props: mergeProps<'button'>(defaultProps, otherProps),
			})}
		</TreeContext.Provider>
	);
}

interface TreeItemLabelProps<T = any> extends React.HTMLAttributes<HTMLSpanElement> {
	item?: ItemInstance<T>;
	onExpansionToggle?: (item: ItemInstance<T>) => void;
}

function TreeItemLabel<T = any>({
	item: propItem,
	children,
	className,
	onExpansionToggle,
	...props
}: TreeItemLabelProps<T>) {
	const { currentItem, toggleIconType } = useTreeContext<T>();
	const item = propItem || currentItem;

	if (!item) {
		console.warn('TreeItemLabel: No item provided via props or context');
		return null;
	}

	return (
		<span
			data-slot='tree-item-label'
			className={cn(
				'flex items-center gap-1 bg-background transition-colors not-in-data-[folder=true]:ps-7 hover:bg-accent in-focus-visible:ring-[3px] in-focus-visible:ring-ring/50 in-data-[drag-target=true]:bg-accent in-data-[search-match=true]:bg-blue-50! in-data-[selected=true]:bg-accent in-data-[selected=true]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0',
				'rounded-md',
				'py-1.5',
				'px-2',
				'text-sm',
				className
			)}
			{...props}
		>
			{item.isFolder() ? (
				<span
					aria-hidden='true'
					className='flex size-6 shrink-0 items-center justify-center rounded-sm p-1 text-muted-foreground transition-colors hover:bg-foreground/12 hover:text-foreground in-data-[selected=true]:hover:bg-primary/15 in-data-[selected=true]:hover:text-primary'
					data-slot='tree-item-toggle'
					onClick={(event) => {
						event.stopPropagation();
						item.setFocused();
						if (onExpansionToggle) {
							onExpansionToggle(item);
						} else if (item.isExpanded()) {
							item.collapse();
						} else {
							item.expand();
						}
					}}
				>
					{toggleIconType === 'plus-minus' ? (
						item.isExpanded() ? (
							<MinusIcon className='size-3.5' stroke='currentColor' strokeWidth='1' />
						) : (
							<PlusIcon className='size-3.5' stroke='currentColor' strokeWidth='1' />
						)
					) : (
						<ChevronDownIcon className='size-4 in-aria-[expanded=false]:-rotate-90' />
					)}
				</span>
			) : null}
			{children || (typeof item.getItemName === 'function' ? item.getItemName() : null)}
		</span>
	);
}

function TreeDragLine({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	const { tree } = useTreeContext();

	if (!tree || typeof tree.getDragLineStyle !== 'function') {
		console.warn(
			'TreeDragLine: No tree provided via context or tree does not have getDragLineStyle method'
		);
		return null;
	}

	const dragLine = tree.getDragLineStyle();
	return (
		<div
			style={dragLine}
			className={cn(
				'absolute z-30 -mt-px h-0.5 w-[unset] bg-primary before:absolute before:-top-[3px] before:left-0 before:size-2 before:border-2 before:border-primary before:bg-background',
				'before:rounded-full',
				className
			)}
			{...props}
		/>
	);
}

export { Tree, TreeItem, TreeItemLabel, TreeDragLine };
