import { useState } from 'react';
import { X } from 'lucide-react';
import { CategoryBadge } from './category-badge';
import { FeedbackSelector } from './feedback-selector';
import type { ReactNode } from 'react';
import type { UpdateCategory } from './category-badge';


import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';


export const UPDATE_CATEGORIES = ['changelog', 'article', 'announcement'] as const;

const UPDATE_CATEGORY_ITEMS = UPDATE_CATEGORIES.map((category) => ({
	label: <CategoryBadge category={category} />,
	value: category,
}));

/**
 * The main editor column shared by the New Update and Edit Update pages —
 * a large title input and its content editor wrapped together in a single
 * Card surface so both pages get the same "document" shape.
 */
export function UpdateEditorCard({ editor, title }: { editor: ReactNode; title: ReactNode }) {
	return (
		<Card className='gap-0 overflow-hidden py-0'>
			<CardContent className='flex flex-col p-0'>
				{title}
				<Separator />
				{editor}
			</CardContent>
		</Card>
	);
}

/**
 * Prominent title input used by both editor pages. Uses the shared Input
 * component's `xl` size so the two pages stay visually consistent.
 */
export function UpdateTitleInput({
	autoFocus,
	maxLength,
	onChange,
	value,
}: {
	autoFocus?: boolean;
	maxLength?: number;
	onChange: (value: string) => void;
	value: string;
}) {
	return (
		<Input
			aria-label='Update title'
			autoFocus={autoFocus}
			className='h-auto border-none bg-transparent p-4 text-lg font-semibold tracking-tight shadow-none ring-0 focus-visible:ring-0 md:text-xl dark:bg-transparent'
			id='update-title'
			maxLength={maxLength}
			onChange={(event) => onChange(event.target.value)}
			placeholder='Update title...'
			size='xl'
			value={value}
			autoComplete='off'
		/>
	);
}

/** Category select used in the sidebar of both editor pages. */
export function CategoryField({
	onValueChange,
	value,
}: {
	onValueChange: (value: UpdateCategory) => void;
	value: UpdateCategory;
}) {
	return (
		<div className='flex flex-col gap-1.5'>
			<label className='text-xs text-muted-foreground'>Category</label>
			<Select
				items={UPDATE_CATEGORY_ITEMS}
				onValueChange={(next) => onValueChange(next as UpdateCategory)}
				value={value}
			>
				<SelectTrigger className='w-full'>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{UPDATE_CATEGORIES.map((category) => (
						<SelectItem key={category} value={category}>
							<CategoryBadge category={category} />
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

/** Tag editor (add/remove) used in the sidebar of both editor pages. */
export function TagsField({
	onChange,
	value,
}: {
	onChange: (tags: Array<string>) => void;
	value: Array<string>;
}) {
	const [tagInput, setTagInput] = useState('');
	const tags = value;

	const addTag = () => {
		const trimmed = tagInput.trim();
		if (!trimmed) return;
		if (!tags.includes(trimmed)) {
			onChange([...tags, trimmed]);
		}
		setTagInput('');
	};

	return (
		<div className='flex flex-col gap-3'>
			{tags.length > 0 ? (
				<div className='flex flex-wrap gap-1.5'>
					{tags.map((tag) => (
						<Badge className='gap-1 pr-1' key={tag} variant='secondary'>
							{tag}
							<Button
								aria-label={`Remove tag ${tag}`}
								variant='ghost'
								size='icon-xs'
								className='ml-0.5 size-4 hover:text-destructive'
								onClick={() => onChange(tags.filter((t) => t !== tag))}
								type='button'
							>
								<X className='h-3 w-3' />
							</Button>
						</Badge>
					))}
				</div>
			) : null}
			<div className='flex items-center gap-2'>
				<Input
					className='flex-1'
					onChange={(event) => setTagInput(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							addTag();
						}
					}}
					placeholder='Add tag...'
					value={tagInput}
				/>
				<Button onClick={addTag} size='sm' type='button' variant='outline'>
					Add
				</Button>
			</div>
		</div>
	);
}

/** Related-feedback selector used in the sidebar of both editor pages. */
export function RelatedFeedbackField({
	onChange,
	projectId,
	selectedIds,
}: {
	onChange: (ids: Array<string>) => void;
	projectId: string;
	selectedIds: Array<string>;
}) {
	return (
		<div className='flex flex-col gap-2'>
			<FeedbackSelector onChange={onChange} projectId={projectId} selectedIds={selectedIds} />
			<p className='text-xs text-muted-foreground'>Link feedback items addressed by this update.</p>
		</div>
	);
}
