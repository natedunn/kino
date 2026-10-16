import type { Id } from '../../../../../../../convex/native/_generated/dataModel';
import type { DiscussionCategory } from './category-dialog';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { Trash2 } from 'lucide-react';

import { BoardIcon } from '@/components/board-icon';
import { InlineAlert } from '@/components/inline-alert';
import { Label } from '@/components/label';
import { Button } from '@/components/ui/button';
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
import { localizeError } from '@/lib/errors';
import * as m from '@/paraglide/messages.js';

import { api } from '../../../../../../../convex/native/_generated/api';

type DeleteCategoryDialogProps = {
	categories: Array<DiscussionCategory>;
	category: DiscussionCategory | null;
	onOpenChange: (open: boolean) => void;
	open: boolean;
};

// Deleting a category moves its discussions into another one, so the dialog
// asks where they should go before confirming.
export function DeleteCategoryDialog({
	categories,
	category,
	onOpenChange,
	open,
}: DeleteCategoryDialogProps) {
	return (
		<ResponsiveDialog onOpenChange={onOpenChange} open={open}>
			<ResponsiveDialogContent
				className='flex flex-col gap-0 overflow-hidden p-0'
				dialogClassName='max-h-[88vh] sm:max-w-lg'
				showCloseButton={false}
			>
				<ResponsiveDialogHeader
					icon={<Trash2 />}
					subtitle={m.settings_discussions_delete_description()}
					title={m.settings_discussions_delete_title({ name: category?.name ?? '' })}
				/>
				{category ? (
					<DeleteCategoryForm
						categories={categories.filter((entry) => entry.id !== category.id)}
						category={category}
						key={category.id}
						onDone={() => onOpenChange(false)}
					/>
				) : null}
			</ResponsiveDialogContent>
		</ResponsiveDialog>
	);
}

function DeleteCategoryForm({
	categories,
	category,
	onDone,
}: {
	categories: Array<DiscussionCategory>;
	category: DiscussionCategory;
	onDone: () => void;
}) {
	const removeCategory = useMutation(api.discussionCategories.remove);
	const [moveToId, setMoveToId] = useState<Id<'discussionCategories'> | null>(
		categories[0]?.id ?? null
	);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const target = categories.find((entry) => entry.id === moveToId);

	const confirm = async () => {
		if (!target) return;
		setPending(true);
		setError(null);
		try {
			await removeCategory({ categoryId: category.id, moveToCategoryId: target.id });
			onDone();
		} catch (removeError) {
			setError(localizeError(removeError, m.settings_discussions_delete_failed()));
		} finally {
			setPending(false);
		}
	};

	return (
		<>
			<ResponsiveDialogBody className='space-y-4'>
				<div className='grid gap-2'>
					<Label>{m.settings_discussions_delete_move_to()}</Label>
					<Select onValueChange={(value) => setMoveToId(value)} value={moveToId}>
						<SelectTrigger className='w-full'>
							<SelectValue>
								{(value) => {
									const selected = categories.find((entry) => entry.id === value);
									return selected ? (
										<span className='flex items-center gap-2'>
											<BoardIcon icon={selected.icon} name={selected.name} size='16px' />
											{selected.name}
										</span>
									) : null;
								}}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{categories.map((entry) => (
								<SelectItem key={entry.id} value={entry.id}>
									<BoardIcon icon={entry.icon} name={entry.name} size='16px' />
									{entry.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				{error ? <InlineAlert variant='danger'>{error}</InlineAlert> : null}
			</ResponsiveDialogBody>
			<ResponsiveDialogFooter>
				<Button disabled={pending} onClick={onDone} size='sm' variant='outline'>
					{m.common_cancel()}
				</Button>
				<Button disabled={!target || pending} onClick={confirm} size='sm' variant='destructive'>
					<Trash2 />
					{pending ? m.common_deleting() : m.settings_discussions_delete_confirm()}
				</Button>
			</ResponsiveDialogFooter>
		</>
	);
}
