import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Filter, SortAsc, SortDesc, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select-shadcn';
import { cn } from '@/lib/utils';

interface FeedbackToolbarConfig {
	statusFilter: string;
	tagFilter: string;
	dateAfter?: Date;
	dateBefore?: Date;
	sortBy: string;
	sortDirection: 'asc' | 'desc';
}

interface FeedbackToolbarProps {
	onChange?: (config: FeedbackToolbarConfig) => void;
}

export function FeedbackToolbar({ onChange }: FeedbackToolbarProps) {
	const [statusFilter, setStatusFilter] = useState<string>('all');
	const [tagFilter, setTagFilter] = useState<string>('all');
	const [dateAfter, setDateAfter] = useState<Date>();
	const [dateBefore, setDateBefore] = useState<Date>();
	const [sortBy, setSortBy] = useState<string>('date-created');
	const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
	const [showFilters, setShowFilters] = useState(false);

	useEffect(() => {
		if (onChange) {
			onChange({
				statusFilter,
				tagFilter,
				dateAfter,
				dateBefore,
				sortBy,
				sortDirection,
			});
		}
	}, [statusFilter, tagFilter, dateAfter, dateBefore, sortBy, sortDirection, onChange]);

	const clearFilters = () => {
		setStatusFilter('all');
		setTagFilter('all');
		setDateAfter(undefined);
		setDateBefore(undefined);
	};

	const toggleSortDirection = () => {
		setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
	};

	const hasActiveFilters = statusFilter !== 'all' || tagFilter !== 'all' || dateAfter || dateBefore;

	return (
		<div className='space-y-4'>
			{/* Main toolbar */}
			<div className='flex items-center justify-between gap-4'>
				<div className='flex items-center gap-2'>
					<Button
						variant={showFilters ? 'default' : 'outline'}
						size='sm'
						onClick={() => setShowFilters(!showFilters)}
					>
						<Filter className='mr-2 h-4 w-4' />
						Filters
						{hasActiveFilters && (
							<Badge
								variant='secondary'
								className='ml-2 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs'
							>
								{
									[statusFilter !== 'all', tagFilter !== 'all', dateAfter, dateBefore].filter(
										Boolean
									).length
								}
							</Badge>
						)}
					</Button>

					{hasActiveFilters && (
						<Button variant='ghost' size='sm' onClick={clearFilters}>
							<X className='mr-2 h-4 w-4' />
							Clear
						</Button>
					)}
				</div>

				<div className='flex items-center gap-2'>
					<Button
						variant='ghost'
						size='sm'
						onClick={toggleSortDirection}
						className='p-2'
						title={`Sort ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
					>
						{sortDirection === 'asc' ? (
							<SortAsc className='h-4 w-4' />
						) : (
							<SortDesc className='h-4 w-4' />
						)}
					</Button>
					<Select value={sortBy} onValueChange={setSortBy}>
						<SelectTrigger className='w-48'>
							<SelectValue placeholder='Sort by...' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='date-created'>Date Created</SelectItem>
							<SelectItem value='recently-commented'>Recently Commented</SelectItem>
							<SelectItem value='most-upvotes'>Most Upvotes</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* Filter panel */}
			{showFilters && (
				<div className='rounded-lg border bg-muted/50 p-4'>
					<div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
						{/* Status Filter */}
						<div className='space-y-2'>
							<Label htmlFor='status-filter'>Status</Label>
							<Select value={statusFilter} onValueChange={setStatusFilter}>
								<SelectTrigger id='status-filter'>
									<SelectValue placeholder='All statuses' />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='all'>All statuses</SelectItem>
									<SelectItem value='open'>Open</SelectItem>
									<SelectItem value='in-progress'>In Progress</SelectItem>
									<SelectItem value='completed'>Completed</SelectItem>
									<SelectItem value='closed'>Closed</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{/* Tag Filter */}
						<div className='space-y-2'>
							<Label htmlFor='tag-filter'>Tag</Label>
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
						</div>

						{/* Date After Filter */}
						<div className='space-y-2'>
							<Label>After Date</Label>
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
						</div>

						{/* Date Before Filter */}
						<div className='space-y-2'>
							<Label>Before Date</Label>
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
						</div>
					</div>
				</div>
			)}

			{/* Active filters display */}
			{hasActiveFilters && (
				<div className='flex flex-wrap gap-2'>
					{statusFilter !== 'all' && (
						<Badge variant='secondary' className='gap-1'>
							Status: {statusFilter}
							<Button
								variant='ghost'
								size='sm'
								className='h-auto p-0 text-muted-foreground hover:text-foreground'
								onClick={() => setStatusFilter('all')}
							>
								<X className='h-3 w-3' />
							</Button>
						</Badge>
					)}
					{tagFilter !== 'all' && (
						<Badge variant='secondary' className='gap-1'>
							Tag: {tagFilter}
							<Button
								variant='ghost'
								size='sm'
								className='h-auto p-0 text-muted-foreground hover:text-foreground'
								onClick={() => setTagFilter('all')}
							>
								<X className='h-3 w-3' />
							</Button>
						</Badge>
					)}
					{dateAfter && (
						<Badge variant='secondary' className='gap-1'>
							After: {format(dateAfter, 'MMM d, yyyy')}
							<Button
								variant='ghost'
								size='sm'
								className='h-auto p-0 text-muted-foreground hover:text-foreground'
								onClick={() => setDateAfter(undefined)}
							>
								<X className='h-3 w-3' />
							</Button>
						</Badge>
					)}
					{dateBefore && (
						<Badge variant='secondary' className='gap-1'>
							Before: {format(dateBefore, 'MMM d, yyyy')}
							<Button
								variant='ghost'
								size='sm'
								className='h-auto p-0 text-muted-foreground hover:text-foreground'
								onClick={() => setDateBefore(undefined)}
							>
								<X className='h-3 w-3' />
							</Button>
						</Badge>
					)}
				</div>
			)}
		</div>
	);
}
