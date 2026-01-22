import { useEffect, useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { Check, Plus, Search, X } from 'lucide-react';

import { api } from '~api';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input-shadcn';
import { Id } from '@/convex/_generated/dataModel';
import { StatusIcon } from '@/icons';
import LoaderQuarter from '@/icons/loader-quarter';
import { cn } from '@/lib/utils';

type FeedbackSelectorProps = {
	projectId: Id<'project'>;
	selectedIds: Id<'feedback'>[];
	onChange: (ids: Id<'feedback'>[]) => void;
};

export function FeedbackSelector({ projectId, selectedIds, onChange }: FeedbackSelectorProps) {
	const [open, setOpen] = useState(false);
	const [searchTerm, setSearchTerm] = useState('');
	const [debouncedSearch, setDebouncedSearch] = useState('');

	// Debounce search input
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(searchTerm);
		}, 300);
		return () => clearTimeout(timer);
	}, [searchTerm]);

	// Search for feedback items
	const { data: searchResults, isLoading: isSearching } = useQuery({
		...convexQuery(api.feedback.searchForLinking, {
			projectId,
			search: debouncedSearch,
		}),
		enabled: open,
	});

	// Get selected items by IDs
	const { data: selectedItems } = useQuery({
		...convexQuery(api.feedback.getByIds, {
			ids: selectedIds,
		}),
		enabled: selectedIds.length > 0,
	});

	const handleSelect = (feedbackId: Id<'feedback'>) => {
		if (selectedIds.includes(feedbackId)) {
			onChange(selectedIds.filter((id) => id !== feedbackId));
		} else {
			onChange([...selectedIds, feedbackId]);
		}
	};

	const handleRemove = (feedbackId: Id<'feedback'>) => {
		onChange(selectedIds.filter((id) => id !== feedbackId));
	};

	const handleOpenChange = (isOpen: boolean) => {
		setOpen(isOpen);
		if (!isOpen) {
			setSearchTerm('');
			setDebouncedSearch('');
		}
	};

	return (
		<div className='flex flex-col gap-3'>
			{/* Selected items list */}
			{selectedItems && selectedItems.length > 0 && (
				<div className='flex flex-col gap-2'>
					{selectedItems.map((item) => (
						<div
							key={item._id}
							className='flex items-center gap-3 rounded-md border bg-muted/30 p-3'
						>
							<StatusIcon status={item.status} size='16' colored />
							<div className='flex-1 min-w-0'>
								<div className='font-medium truncate'>{item.title}</div>
								{item.board && (
									<div className='text-xs text-muted-foreground'>{item.board.name}</div>
								)}
							</div>
							<button
								type='button'
								onClick={() => handleRemove(item._id)}
								className='p-1 rounded hover:bg-muted'
								aria-label={`Remove ${item.title}`}
							>
								<X className='h-4 w-4 text-muted-foreground hover:text-destructive' />
							</button>
						</div>
					))}
				</div>
			)}

			{/* Add button with dialog */}
			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogTrigger
					className={cn(
						'inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
					)}
				>
					<Plus className='h-4 w-4' />
					Link Feedback
				</DialogTrigger>
				<DialogContent className='sm:max-w-lg'>
					<DialogHeader>
						<DialogTitle>Link Related Feedback</DialogTitle>
						<DialogDescription>
							Search and select feedback items that are addressed by this update.
						</DialogDescription>
					</DialogHeader>

					{/* Search input */}
					<div className='relative'>
						<Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
						<Input
							placeholder='Search feedback...'
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className='pl-9'
							autoFocus
						/>
					</div>

					{/* Search results */}
					<div className='max-h-[300px] overflow-y-auto rounded-md border'>
						{isSearching ? (
							<div className='flex items-center justify-center py-8'>
								<LoaderQuarter className='h-5 w-5 animate-spin text-muted-foreground' />
							</div>
						) : searchResults && searchResults.length > 0 ? (
							<div className='flex flex-col'>
								{searchResults.map((item) => {
									const isSelected = selectedIds.includes(item._id);
									return (
										<button
											key={item._id}
											type='button'
											onClick={() => handleSelect(item._id)}
											className={cn(
												'flex items-center gap-3 p-3 text-left hover:bg-muted/50 border-b last:border-b-0 transition-colors',
												isSelected && 'bg-muted/30'
											)}
										>
											<div
												className={cn(
													'flex h-5 w-5 items-center justify-center rounded border',
													isSelected
														? 'border-primary bg-primary text-primary-foreground'
														: 'border-muted-foreground/30'
												)}
											>
												{isSelected && <Check className='h-3 w-3' />}
											</div>
											<StatusIcon status={item.status} size='16' colored />
											<div className='flex-1 min-w-0'>
												<div className='font-medium truncate'>{item.title}</div>
												{item.board && (
													<div className='text-xs text-muted-foreground'>{item.board.name}</div>
												)}
											</div>
										</button>
									);
								})}
							</div>
						) : (
							<div className='py-8 text-center text-sm text-muted-foreground'>
								{debouncedSearch ? 'No feedback found.' : 'Type to search feedback...'}
							</div>
						)}
					</div>

					{selectedIds.length > 0 && (
						<div className='text-sm text-muted-foreground'>
							{selectedIds.length} item{selectedIds.length !== 1 ? 's' : ''} selected
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
