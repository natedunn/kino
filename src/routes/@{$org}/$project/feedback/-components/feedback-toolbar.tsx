import React from 'react';
import { useParams, useRouter, useSearch } from '@tanstack/react-router';
// import { format } from 'date-fns';
import { X } from 'lucide-react';
import { debounce } from 'perfect-debounce';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectPositioner,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import Filter from '@/icons/filter';

const FROM_ROUTE = '/@{$org}/$project/feedback/';
const TO_ROUTE = '/@{$org}/$project/feedback';
const STATUS_OPTIONS: {
	label: string;
	value: typeof status | null;
}[] = [
	{
		label: 'All statuses',
		value: null,
	},
	{
		label: 'Open',
		value: 'open',
	},
	{
		label: 'In Progress',
		value: 'in-progress',
	},
	{
		label: 'Completed',
		value: 'completed',
	},
	{
		label: 'Closed',
		value: 'closed',
	},
];

export function FeedbackToolbar() {
	const { navigate } = useRouter();

	const searchParams = useSearch({
		from: FROM_ROUTE,
	});
	const { search, status, board } = searchParams;

	const params = useParams({
		from: FROM_ROUTE,
	});
	const { org, project } = params;

	const [showFilters, setShowFilters] = React.useState(false);
	const [searchTerm, setSearchTerm] = React.useState(!search ? '' : search);
	// const [loading, setLoading] = React.useState<boolean>(false);

	const setSearchParams = (search: Omit<typeof searchParams, 'board'>) => {
		navigate({
			to: TO_ROUTE,
			params: {
				org,
				project,
			},
			search: (prev) => ({
				...prev,
				...search,
				board: board ?? 'all',
			}),
		});
	};

	const clearFilters = () => {
		setSearchTerm('');
		setSearchParams({
			status: undefined,
		});
	};

	const hasActiveFilters = status;

	React.useEffect(() => {
		const debounced = debounce(
			async (value: string) =>
				setSearchParams({
					search: value.trim() === '' ? undefined : value,
				}),
			250,
			{ trailing: false }
		);

		debounced(searchTerm);

		return () => {
			debounced.cancel();
		};
	}, [searchTerm]);

	return (
		<div className='space-y-4'>
			{/* Main toolbar */}
			<div className='flex items-center justify-between gap-4'>
				<div className='flex items-center gap-2'>
					<Button
						variant={showFilters || hasActiveFilters ? 'default' : 'outline'}
						onClick={() => setShowFilters(!showFilters)}
					>
						<Filter className='mr-2 h-4 w-4' />
						Filters
						{hasActiveFilters && (
							<Badge
								variant='secondary'
								className='ml-2 flex h-5 w-5 items-center justify-center rounded-full p-0 pr-px text-[10px]'
							>
								{[status].filter(Boolean).length}
							</Badge>
						)}
					</Button>

					{hasActiveFilters && (
						<Button
							variant='outline'
							onClick={() => {
								setShowFilters(false);
								clearFilters();
							}}
						>
							<X className='mr-2 h-4 w-4' />
							Clear All
						</Button>
					)}
				</div>

				<div className='flex items-center gap-2'>
					<Input
						value={searchTerm}
						onChange={(e) => {
							setSearchTerm(e.target.value);
						}}
						placeholder='Search...'
					/>
					{/* <Select items={statusOptions}>
						<SelectTrigger className='w-48'>
							<SelectValue placeholder='Select a status' />
						</SelectTrigger>
						<Select.Portal>
							<Select.Backdrop />
							<Select.Positioner>
								<Select.ScrollUpArrow />
								<Select.Popup>
									<S
								</Select.Popup>
							</Select.Positioner>
							<SelectItem value='date-created'>Date Created</SelectItem>
							<SelectItem value='recently-commented'>Recently Commented</SelectItem>
							<SelectItem value='most-upvotes'>Most Upvotes</SelectItem>
							<SelectItem value='trending'>Trending</SelectItem>
						</Select.Portal>
					</Select> */}
					{/* <Button
						variant='ghost'
						size='icon'
						onClick={toggleSortDirection}
						className='p-2'
						title={`Sort ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
					>
						{sortDirection === 'asc' ? (
							<SortAsc className='h-4 w-4' />
						) : (
							<SortDesc className='h-4 w-4' />
						)}
					</Button> */}
				</div>
			</div>

			{/* Filter panel */}
			{(showFilters || hasActiveFilters) && (
				<div className='rounded-lg border bg-muted/50 p-4'>
					<div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
						{/* Status Filter */}
						<div className='space-y-2'>
							<Label htmlFor='status-filter' className='text-muted-foreground'>
								Status
							</Label>
							<div>
								<Select
									items={STATUS_OPTIONS}
									value={!status ? null : status}
									onValueChange={(value) => {
										// setLoading(true);
										setSearchParams({
											status: value === null ? undefined : value,
										});
									}}
								>
									<SelectTrigger id='status-filter'>
										<SelectValue placeholder='All statuses' />
									</SelectTrigger>
									<SelectPositioner alignItemWithTrigger>
										<SelectContent>
											{STATUS_OPTIONS.map(({ label, value }) => (
												<SelectItem key={`value-${value ?? 'undefined'}`} value={value}>
													{label}
												</SelectItem>
											))}
										</SelectContent>
									</SelectPositioner>
								</Select>
							</div>
						</div>

						{/* Tag Filter */}
						{/* <div className='space-y-2'>
							<Label htmlFor='tag-filter' className='text-muted-foreground'>
								Tag
							</Label>
							<Select value={tagFilter} onValueChange={setTagFilter}>
								<SelectTrigger id='tag-filter'>
									<SelectValue placeholder='All tags' />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='all'>All tags</SelectItem>
									<SelectItem value='bug'>Bug</SelectItem>
									<SelectItem value='feature'>Feature Request</SelectItem>
									<SelectItem value='improvement'>Improvement</SelectItem>
									<SelectItem value='question'>Question</SelectItem>
								</SelectContent>
							</Select>
						</div> */}

						{/* Date After Filter */}
						{/* <div className='space-y-2'>
							<Label className='text-muted-foreground'>After Date</Label>
							<Popover>
								<PopoverTrigger asChild>
									<Button
										variant='outline'
										className={cn(
											'w-full justify-start text-left font-normal',
											!dateAfter && 'text-muted-foreground'
										)}
									>
										<CalendarIcon className='mr-2 h-4 w-4' />
										{dateAfter ? format(dateAfter, 'PPP') : 'Pick a date'}
									</Button>
								</PopoverTrigger>
								<PopoverContent className='w-auto p-0' align='start'>
									<Calendar
										mode='single'
										selected={dateAfter}
										onSelect={setDateAfter}
										initialFocus
									/>
								</PopoverContent>
							</Popover>
						</div> */}

						{/* Date Before Filter */}
						{/* <div className='space-y-2'>
							<Label className='text-muted-foreground'>Before Date</Label>
							<Popover>
								<PopoverTrigger asChild>
									<Button
										variant='outline'
										className={cn(
											'w-full justify-start text-left font-normal',
											!dateBefore && 'text-muted-foreground'
										)}
									>
										<CalendarIcon className='mr-2 h-4 w-4' />
										{dateBefore ? format(dateBefore, 'PPP') : 'Pick a date'}
									</Button>
								</PopoverTrigger>
								<PopoverContent className='w-auto p-0' align='start'>
									<Calendar
										mode='single'
										selected={dateBefore}
										onSelect={setDateBefore}
										initialFocus
									/>
								</PopoverContent>
							</Popover>
						</div> */}
					</div>
				</div>
			)}

			{/* Active filters display */}
			{hasActiveFilters && (
				<div className='flex flex-wrap gap-2'>
					{status && (
						<Badge variant='secondary' className='gap-2 pl-3'>
							<span className='text-muted-foreground'>Status:</span>
							{status}
							<Button
								variant='ghost'
								size='icon'
								className='h-auto w-auto p-1 text-muted-foreground hover:text-foreground'
								onClick={() => {
									setSearchParams({
										status: undefined,
									});
								}}
							>
								<X className='h-3 w-3' />
							</Button>
						</Badge>
					)}
					{/* {tagFilter !== 'all' && (
						<Badge variant='secondary' className='gap-2 pl-3'>
							<span className='text-muted-foreground'>Tag:</span>
							{tagFilter}
							<Button
								variant='ghost'
								size='icon'
								className='h-auto w-auto p-1 text-muted-foreground hover:text-foreground'
								onClick={() => setTagFilter('all')}
							>
								<X className='h-3 w-3' />
							</Button>
						</Badge>
					)} */}
					{/* {dateAfter && (
						<Badge variant='secondary' className='gap-2 pl-3'>
							<span className='text-muted-foreground'>After:</span>
							{format(dateAfter, 'MMM d, yyyy')}
							<Button
								variant='ghost'
								size='icon'
								className='h-auto w-auto p-1 text-muted-foreground hover:text-foreground'
								onClick={() => setDateAfter(undefined)}
							>
								<X className='h-3 w-3' />
							</Button>
						</Badge>
					)} */}
					{/* {dateBefore && (
						<Badge variant='secondary' className='gap-2 pl-3'>
							<span className='text-muted-foreground'>Before:</span>{' '}
							{format(dateBefore, 'MMM d, yyyy')}
							<Button
								variant='ghost'
								size='icon'
								className='h-auto w-auto p-1 text-muted-foreground hover:text-foreground'
								onClick={() => setDateBefore(undefined)}
							>
								<X className='h-3 w-3' />
							</Button>
						</Badge>
					)} */}
				</div>
			)}
		</div>
	);
}
