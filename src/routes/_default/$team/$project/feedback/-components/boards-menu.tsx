'use client';

import { useState } from 'react';
import { ArrowDownWideNarrow, Check } from 'lucide-react';

import { cn } from '@/lib/utils';

interface SidebarMenuProps {
	items?: string[];
	onSelectionChange?: (selected: string[]) => void;
}

export default function BoardsMenu({
	items = ['🐞 Bugs', '💡 Feature Requests', '📈 Improvements', '❓ Questions'],
	onSelectionChange,
}: SidebarMenuProps) {
	const [selectedCategories, setSelectedCategories] = useState<string[]>(items);

	const allSelected = selectedCategories.length === items.length;

	const handleCategoryToggle = (category: string) => {
		const newSelection = selectedCategories.includes(category)
			? selectedCategories.filter((c) => c !== category)
			: [...selectedCategories, category];

		setSelectedCategories(newSelection);
		onSelectionChange?.(newSelection);
	};

	const handleSelectAll = () => {
		const newSelection = allSelected ? [] : items;
		setSelectedCategories(newSelection);
		onSelectionChange?.(newSelection);
	};

	return (
		<div className='w-full space-y-2'>
			{/* Select All Button */}
			<button
				onClick={handleSelectAll}
				className={cn(
					'flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors',
					'cursor-pointer text-muted-foreground hocus:bg-accent',
					allSelected ? 'bg-muted text-foreground' : 'text-muted-foreground'
				)}
			>
				<span className='inline-flex items-center gap-2'>
					<ArrowDownWideNarrow className='size-5' />
					Select All
				</span>
				<div
					className={cn(
						'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors',
						allSelected ? 'border-primary bg-primary' : 'border-foreground/10 bg-accent'
					)}
				>
					{allSelected && <Check className='h-3 w-3 text-primary-foreground' />}
				</div>
			</button>

			{/* Category Buttons */}
			{items.map((category) => {
				const isSelected = selectedCategories.includes(category);

				return (
					<button
						key={category}
						onClick={() => handleCategoryToggle(category)}
						className={cn(
							'flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm transition-colors',
							'hover:bg-accent hover:text-accent-foreground',
							'cursor-pointer hover:text-foreground',
							isSelected ? 'bg-muted text-foreground' : 'text-muted-foreground'
						)}
					>
						<span>{category}</span>
						<div
							className={cn(
								'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors',
								isSelected ? 'border-primary bg-primary' : 'border-foreground/10 bg-accent'
							)}
						>
							{isSelected && <Check className='h-3 w-3 text-primary-foreground' />}
						</div>
					</button>
				);
			})}
		</div>
	);
}
