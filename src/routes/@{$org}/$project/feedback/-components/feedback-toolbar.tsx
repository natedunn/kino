import type { ReactNode } from 'react';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearch } from '@tanstack/react-router';
import { Search, X } from 'lucide-react';

import { useRegisterCommands } from '@/components/command';
import { useRegisterShortcuts } from '@/components/shortcuts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	ResponsiveDialog,
	ResponsiveDialogBody,
	ResponsiveDialogContent,
	ResponsiveDialogFooter,
	ResponsiveDialogHeader,
} from '@/components/ui/responsive-dialog';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import Filter from '@/icons/filter';
import { Filter2Outline18 } from '@/icons/nucleo/Filter2Outline18';
import { cn } from '@/lib/utils';
import * as m from '@/paraglide/messages.js';

const FROM_ROUTE = '/@{$org}/$project/feedback/';
const TO_ROUTE = '/@{$org}/$project/feedback';
const SEARCH_INPUT_ID = 'feedback-search';
const STATUS_FILTER_ID = 'status-filter';
const STATUS_OPTIONS = [
	{ label: m.feedback_index_all_statuses, value: null },
	{ label: m.feedback_status_open, value: 'open' },
	{ label: m.feedback_status_in_progress, value: 'in-progress' },
	{ label: m.feedback_status_completed, value: 'completed' },
	{ label: m.feedback_status_closed, value: 'closed' },
] as const;

export function FeedbackToolbar({
	leadingControl,
	topRowClassName,
}: {
	leadingControl?: ReactNode;
	topRowClassName?: string;
} = {}) {
	const { navigate } = useRouter();
	const searchParams = useSearch({ from: FROM_ROUTE });
	const { search, status, board } = searchParams;
	const { org, project } = useParams({ from: FROM_ROUTE });
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [searchTerm, setSearchTerm] = useState(!search ? '' : search);
	const searchTimeoutRef = useRef<number | null>(null);
	const statusOptions = STATUS_OPTIONS.map((option) => ({ ...option, label: option.label() }));

	const setSearchParams = useCallback(
		(next: Omit<typeof searchParams, 'board'>) => {
			navigate({
				params: { org, project },
				search: (prev) => ({
					...prev,
					...next,
					board: board ?? 'all',
				}),
				to: TO_ROUTE,
			});
		},
		[board, navigate, org, project]
	);

	const clearSearchTimeout = useCallback(() => {
		if (searchTimeoutRef.current === null) return;
		window.clearTimeout(searchTimeoutRef.current);
		searchTimeoutRef.current = null;
	}, []);

	const scheduleSearch = useCallback(
		(nextSearchTerm: string) => {
			clearSearchTimeout();
			searchTimeoutRef.current = window.setTimeout(() => {
				setSearchParams({
					search: nextSearchTerm.trim() === '' ? undefined : nextSearchTerm,
				});
				searchTimeoutRef.current = null;
			}, 250);
		},
		[clearSearchTimeout, setSearchParams]
	);

	const clearFilters = () => {
		clearSearchTimeout();
		setSearchTerm('');
		setSearchParams({ search: undefined, status: undefined });
	};

	const activeFilterCount = [status].filter(Boolean).length;
	const hasActiveFilters = activeFilterCount > 0;

	const focusSearch = useCallback(() => {
		const input = document.getElementById(SEARCH_INPUT_ID);
		if (input instanceof HTMLInputElement) {
			input.focus();
			input.select();
		}
	}, []);

	const toggleFilters = useCallback(() => {
		setFiltersOpen((value) => !value);
	}, []);

	const shortcuts = useMemo(
		() => [
			{
				group: 'Feedback' as const,
				id: 'feedback.search',
				keys: ['f'],
				description: m.feedback_index_focus_search(),
				run: focusSearch,
			},
			{
				group: 'Feedback' as const,
				id: 'feedback.filters',
				keys: ['i'],
				description: m.feedback_index_toggle_filters(),
				run: toggleFilters,
			},
		],
		[focusSearch, toggleFilters]
	);

	const commands = useMemo(
		() => [
			{
				group: 'Feedback' as const,
				icon: Search,
				id: 'feedback.focus-search',
				keywords: ['find', 'search', 'filter'],
				shortcut: 'F',
				title: m.feedback_index_focus_search(),
				run: focusSearch,
			},
			{
				group: 'Feedback' as const,
				icon: Filter2Outline18,
				id: 'feedback.toggle-filters',
				keywords: ['filter', 'status', 'options'],
				shortcut: 'I',
				title: m.feedback_index_toggle_filters(),
				run: toggleFilters,
			},
		],
		[focusSearch, toggleFilters]
	);

	useRegisterShortcuts('feedback-toolbar', shortcuts);
	useRegisterCommands('feedback-toolbar', commands);

	useEffect(() => {
		return clearSearchTimeout;
	}, [clearSearchTimeout]);

	return (
		<div className='flex min-w-0 flex-col gap-4'>
			<div
				className={cn(
					'flex min-w-0 items-center justify-between gap-4',
					topRowClassName
				)}
			>
				<div className='flex min-w-0 items-center gap-2'>
					<div className='relative min-w-0 flex-1'>
						<Search className='pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground' />
						<Input
							autoCapitalize='none'
							autoComplete='off'
							autoCorrect='off'
							className='min-w-0 pl-9'
							id={SEARCH_INPUT_ID}
							onChange={(event) => {
								setSearchTerm(event.target.value);
								scheduleSearch(event.target.value);
							}}
							placeholder={m.feedback_index_search_placeholder()}
							spellCheck={false}
							value={searchTerm}
						/>
					</div>
				</div>

				<div className='flex items-center gap-2'>
					{leadingControl}
					<Button
						onClick={toggleFilters}
						variant={filtersOpen || hasActiveFilters ? 'default' : 'outline'}
					>
						<Filter className='mr-2 h-4 w-4' />
						<span>{m.feedback_index_filters()}</span>
						{hasActiveFilters ? (
							<Badge
								className='ml-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px]'
								variant='secondary'
							>
								{activeFilterCount}
							</Badge>
						) : null}
					</Button>
				</div>
			</div>

			<ResponsiveDialog onOpenChange={setFiltersOpen} open={filtersOpen}>
				<ResponsiveDialogContent
					className='flex flex-col gap-0 overflow-hidden p-0'
					dialogClassName='sm:max-w-lg'
					showCloseButton={false}
				>
					<ResponsiveDialogHeader icon={<Filter className='size-4' />} title={m.feedback_index_filters()} />
					<ResponsiveDialogBody className='space-y-4 p-4'>
						<div className='space-y-2'>
							<label className='text-muted-foreground' htmlFor={STATUS_FILTER_ID}>
								{m.feedback_status()}
							</label>
							<Select
								items={statusOptions}
								onValueChange={(value) => {
									setSearchParams({
										status: value ?? undefined,
									});
								}}
								value={!status ? null : status}
							>
								<SelectTrigger id={STATUS_FILTER_ID}>
									<SelectValue placeholder={m.feedback_index_all_statuses()} />
								</SelectTrigger>
								<SelectContent>
									{statusOptions.map(({ label, value }) => (
										<SelectItem key={`value-${value ?? 'undefined'}`} value={value}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</ResponsiveDialogBody>
					<ResponsiveDialogFooter>
						<Button
							disabled={!hasActiveFilters}
							onClick={() => {
								clearFilters();
							}}
							variant='outline'
						>
							<X className='mr-2 h-4 w-4' />
							{m.feedback_index_clear_all()}
						</Button>
					</ResponsiveDialogFooter>
				</ResponsiveDialogContent>
			</ResponsiveDialog>
		</div>
	);
}
