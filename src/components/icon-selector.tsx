import type { ComponentType, KeyboardEvent as ReactKeyboardEvent, SVGProps } from 'react';

import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type IconSelectorTone = 'duo' | 'outline';

export type IconSelectorOption<TValue extends string = string> = {
	icon: ComponentType<SVGProps<SVGSVGElement> & { size?: string }>;
	keywords?: Array<string>;
	label: string;
	tone: IconSelectorTone;
	value: TValue;
};

type IconSelectorProps<TValue extends string = string> = {
	className?: string;
	contentClassName?: string;
	disabled?: boolean;
	emptyLabel?: string;
	label?: string;
	onValueChange: (value: TValue) => void;
	options: ReadonlyArray<IconSelectorOption<TValue>>;
	placeholder?: string;
	triggerClassName?: string;
	value?: TValue | null;
};

const TONE_LABELS: Record<IconSelectorTone, string> = {
	duo: 'Duo',
	outline: 'Outline',
};

const ICON_GRID_COLUMNS = 4;

function matchesQuery<TValue extends string>(option: IconSelectorOption<TValue>, query: string) {
	if (!query) return true;
	const haystack = [option.label, option.value, ...(option.keywords ?? [])].join(' ').toLowerCase();
	return haystack.includes(query);
}

function IconSelectorInner<TValue extends string = string>({
	className,
	contentClassName,
	disabled,
	emptyLabel = 'No icons found',
	label = 'Icon',
	onValueChange,
	options,
	placeholder = 'Select icon',
	triggerClassName,
	value,
}: IconSelectorProps<TValue>) {
	const id = useId();
	const contentRef = useRef<HTMLDivElement>(null);
	const previousQueryRef = useRef('');
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState('');
	const [activeValue, setActiveValue] = useState<TValue | null>(null);
	const selected = useMemo(
		() => options.find((option) => option.value === value) ?? null,
		[options, value]
	);
	const SelectedIcon = selected?.icon;
	const normalizedQuery = query.trim().toLowerCase();
	const filteredOptions = useMemo(
		() => options.filter((option) => matchesQuery(option, normalizedQuery)),
		[normalizedQuery, options]
	);
	const groupedOptions = useMemo(
		() =>
			(['duo', 'outline'] as const)
				.map((groupTone) => ({
					options: filteredOptions.filter((option) => option.tone === groupTone),
					tone: groupTone,
				}))
				.filter((group) => group.options.length > 0),
		[filteredOptions]
	);
	const visibleOptions = useMemo(
		() => groupedOptions.flatMap((group) => group.options),
		[groupedOptions]
	);
	const activeIndex = useMemo(
		() => visibleOptions.findIndex((option) => option.value === activeValue),
		[activeValue, visibleOptions]
	);
	const activeOption = activeIndex >= 0 ? visibleOptions[activeIndex] : null;
	const listboxId = `${id}-listbox`;
	const getOptionId = (option: IconSelectorOption<TValue>) =>
		`${id}-option-${option.value.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
	const setActiveIndex = (nextIndex: number) => {
		if (visibleOptions.length === 0) return;
		const clampedIndex = Math.max(0, Math.min(visibleOptions.length - 1, nextIndex));
		setActiveValue(visibleOptions[clampedIndex]?.value ?? null);
	};
	const selectActiveOption = () => {
		if (!activeOption) return;
		onValueChange(activeOption.value);
		setOpen(false);
	};
	const handleContentKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		if (visibleOptions.length === 0) return;

		let nextIndex: number | null = null;
		const currentIndex = activeIndex >= 0 ? activeIndex : -1;
		switch (event.key) {
			case 'ArrowRight':
				nextIndex = currentIndex + 1;
				break;
			case 'ArrowLeft':
				nextIndex = currentIndex - 1;
				break;
			case 'ArrowDown':
				nextIndex = currentIndex + ICON_GRID_COLUMNS;
				break;
			case 'ArrowUp':
				nextIndex = currentIndex - ICON_GRID_COLUMNS;
				break;
			case 'Home':
				nextIndex = 0;
				break;
			case 'End':
				nextIndex = visibleOptions.length - 1;
				break;
			case 'Enter':
				event.preventDefault();
				selectActiveOption();
				return;
			default:
				return;
		}

		event.preventDefault();
		setActiveIndex(nextIndex);
	};

	useEffect(() => {
		if (!open) {
			previousQueryRef.current = normalizedQuery;
			return;
		}

		const queryChanged = previousQueryRef.current !== normalizedQuery;
		previousQueryRef.current = normalizedQuery;

		if (visibleOptions.length === 0) {
			setActiveValue(null);
			return;
		}

		setActiveValue((current) => {
			if (queryChanged) return visibleOptions[0]?.value ?? null;
			if (current && visibleOptions.some((option) => option.value === current)) return current;
			if (!normalizedQuery && value) {
				const selectedOption = visibleOptions.find((option) => option.value === value);
				if (selectedOption) return selectedOption.value;
			}
			return visibleOptions[0]?.value ?? null;
		});
	}, [normalizedQuery, open, value, visibleOptions]);

	useEffect(() => {
		if (!open) return;
		contentRef.current
			?.querySelector('[data-icon-selector-active="true"]')
			?.scrollIntoView({ block: 'nearest' });
	}, [activeValue, open]);

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (nextOpen) setActiveValue(null);
	};

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					aria-label={label}
					className={cn(
						'h-11 w-full justify-between px-3 focus-visible:ring-3 focus-visible:ring-ring-accent/25',
						triggerClassName
					)}
					disabled={disabled}
					type='button'
					variant='outline'
				>
					<span className='flex min-w-0 items-center gap-2.5'>
						<span className='flex size-8 shrink-0 items-center justify-center text-foreground'>
							{SelectedIcon ? <SelectedIcon className='size-4' /> : null}
						</span>
						<span className='flex min-w-0 items-baseline gap-1'>
							<span className='truncate'>{selected?.label ?? placeholder}</span>
							{selected ? (
								<span className='shrink-0 text-[10px] leading-none font-medium text-muted-foreground uppercase'>
									{TONE_LABELS[selected.tone]}
								</span>
							) : null}
						</span>
					</span>
					<ChevronsUpDown className='size-3.5 opacity-60' />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align='start'
				className={cn('w-(--anchor-width) min-w-80 p-2', contentClassName)}
			>
				<div
					className={cn('space-y-2', className)}
					onKeyDown={handleContentKeyDown}
					ref={contentRef}
				>
					<div className='relative'>
						<Search className='pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground' />
						<Input
							aria-activedescendant={activeOption ? getOptionId(activeOption) : undefined}
							aria-autocomplete='list'
							aria-controls={listboxId}
							aria-expanded={open}
							autoComplete='off'
							autoFocus
							className='pl-8'
							onChange={(event) => setQuery(event.target.value)}
							placeholder='Search icons...'
							role='combobox'
							size='sm'
							value={query}
						/>
					</div>
					<div className='max-h-80 overflow-y-auto pr-1' id={listboxId} role='listbox'>
						{groupedOptions.length > 0 ? (
							<div className='space-y-3'>
								{groupedOptions.map((group) => (
									<div className='space-y-1.5 pt-1' key={group.tone}>
										<div className='flex items-center justify-between px-1'>
											<span className='text-[11px] font-medium text-muted-foreground/60 uppercase'>
												{TONE_LABELS[group.tone]}
											</span>
											<span className='inline-flex min-w-5 items-center justify-center rounded bg-muted px-1.5 py-0.5 text-[10px] leading-none font-medium text-muted-foreground/70'>
												{group.options.length}
											</span>
										</div>
										<div className='grid grid-cols-4 gap-1'>
											{group.options.map((option) => (
												<IconOptionButton
													key={option.value}
													onSelect={() => {
														onValueChange(option.value);
														setOpen(false);
													}}
													onActivate={() => setActiveValue(option.value)}
													active={option.value === activeOption?.value}
													id={getOptionId(option)}
													option={option}
													selected={option.value === value}
												/>
											))}
										</div>
									</div>
								))}
							</div>
						) : (
							<div className='py-8 text-center text-sm text-muted-foreground'>{emptyLabel}</div>
						)}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

const IconOptionButton = memo(function IconOptionButton<TValue extends string>({
	active,
	id,
	onActivate,
	onSelect,
	option,
	selected,
}: {
	active?: boolean;
	id: string;
	onActivate: () => void;
	onSelect: () => void;
	option: IconSelectorOption<TValue>;
	selected: boolean;
}) {
	const OptionIcon = option.icon;
	return (
		<button
			aria-selected={selected}
			className={cn(
				'group relative flex min-h-18 flex-col items-center justify-center gap-1 rounded-md border p-2 text-center text-foreground transition-colors outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring-accent/25',
				selected
					? 'border-primary bg-primary/10'
					: 'border-transparent bg-muted/30 hover:border-foreground/15 hover:bg-muted',
				active
					? 'border-primary ring-3 ring-ring-accent/25'
					: selected
						? 'ring-2 ring-primary/20'
						: null
			)}
			data-icon-selector-active={active ? 'true' : undefined}
			data-icon-selector-option=''
			id={id}
			onClick={onSelect}
			onFocus={onActivate}
			onPointerEnter={onActivate}
			role='option'
			tabIndex={-1}
			title={option.label}
			type='button'
		>
			<span className='flex size-8 items-center justify-center text-foreground'>
				<OptionIcon className='size-4' />
			</span>
			<span className='flex max-w-full flex-col items-center gap-0.5'>
				<span className='max-w-full truncate text-[11px] leading-tight font-medium'>
					{option.label}
				</span>
				<span className='text-[9px] leading-none font-medium text-muted-foreground uppercase'>
					{TONE_LABELS[option.tone]}
				</span>
			</span>
			{selected ? (
				<span className='absolute top-1 left-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground'>
					<Check className='size-3' />
				</span>
			) : null}
		</button>
	);
});

export const IconSelector = memo(IconSelectorInner) as typeof IconSelectorInner;
