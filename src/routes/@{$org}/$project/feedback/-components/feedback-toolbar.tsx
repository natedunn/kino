import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearch } from '@tanstack/react-router';
import { Search, X } from 'lucide-react';

import { useRegisterCommands } from '@/components/command';
import { useRegisterShortcuts } from '@/components/shortcuts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import Filter from '@/icons/filter';
import { Filter2Outline18 } from '@/icons/nucleo/Filter2Outline18';
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

export function FeedbackToolbar() {
	const { navigate } = useRouter();
	const searchParams = useSearch({ from: FROM_ROUTE });
	const { search, status, board } = searchParams;
	const { org, project } = useParams({ from: FROM_ROUTE });
	// Visibility is driven solely by this state so the panel can always be
	// toggled shut, even when a filter is active. It starts open if the user
	// arrives with a filter already applied.
	const [showFilters, setShowFilters] = useState(() => Boolean(status));
	const [searchTerm, setSearchTerm] = useState(!search ? '' : search);
	const filtersPanelRef = useRef<HTMLDivElement>(null);
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

	const hasActiveFilters = status;

	const focusSearch = useCallback(() => {
		const input = document.getElementById(SEARCH_INPUT_ID);
		if (input instanceof HTMLInputElement) {
			input.focus();
			input.select();
		}
	}, []);

	const toggleFilters = useCallback(() => {
		setShowFilters((value) => {
			const next = !value;
			// When revealing the panel, move focus to the region so the next Tab
			// lands on the first control inside it.
			if (next) {
				window.requestAnimationFrame(() => filtersPanelRef.current?.focus());
			}
			return next;
		});
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
		<div className='space-y-4'>
			<div className='flex items-center justify-between gap-4'>
				<div className='flex items-center gap-2'>
					<Button
						onClick={toggleFilters}
						variant={showFilters || hasActiveFilters ? 'default' : 'outline'}
					>
						<Filter className='mr-2 h-4 w-4' />
						{m.feedback_index_filters()}
						{hasActiveFilters ? (
							<Badge
								className='ml-2 flex h-5 w-5 items-center justify-center rounded-full p-0 pr-px text-[10px]'
								variant='secondary'
							>
								{[status].filter(Boolean).length}
							</Badge>
						) : null}
					</Button>

					{hasActiveFilters ? (
						<Button
							onClick={() => {
								setShowFilters(false);
								clearFilters();
							}}
							variant='outline'
						>
							<X className='mr-2 h-4 w-4' />
							{m.feedback_index_clear_all()}
						</Button>
					) : null}
				</div>

				<div className='flex items-center gap-2'>
					<Input
						id={SEARCH_INPUT_ID}
						onChange={(event) => {
							setSearchTerm(event.target.value);
							scheduleSearch(event.target.value);
						}}
						placeholder={m.feedback_index_search_placeholder()}
						value={searchTerm}
					/>
				</div>
			</div>

			{showFilters ? (
				<div
					ref={filtersPanelRef}
					aria-label={m.feedback_index_filters()}
					className='rounded-lg border bg-muted/50 p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
					role='region'
					tabIndex={-1}
				>
					<div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
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
					</div>
				</div>
			) : null}
		</div>
	);
}
