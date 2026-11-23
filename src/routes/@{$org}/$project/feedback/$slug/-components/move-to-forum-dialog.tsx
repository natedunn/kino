import type { Id } from '../../../../../../../convex/native/_generated/dataModel';

import { useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { MessagesSquare } from 'lucide-react';

import { BoardIcon } from '@/components/board-icon';
import { InlineAlert } from '@/components/inline-alert';
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

import { api as nativeApi } from '../../../../../../../convex/native/_generated/api';

const ROUTE = '/@{$org}/$project/feedback/$slug/' as const;

// Moves the feedback into a topic in the chosen forum category, then opens it.
export function MoveToForumDialog({
	feedbackId,
	onOpenChange,
	open,
	projectId,
}: {
	feedbackId: Id<'feedback'>;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	projectId: Id<'projects'>;
}) {
	return (
		<ResponsiveDialog onOpenChange={onOpenChange} open={open}>
			<ResponsiveDialogContent
				className='flex flex-col gap-0 overflow-hidden p-0'
				dialogClassName='max-h-[88vh] sm:max-w-lg'
				showCloseButton={false}
			>
				<ResponsiveDialogHeader
					icon={<MessagesSquare />}
					subtitle={m.feedback_move_to_forum_description()}
					title={m.feedback_move_to_forum()}
				/>
				{/* Only mounted while open, so closing resets the category choice. */}
				{open ? (
					<MoveDialogBody
						feedbackId={feedbackId}
						onClose={() => onOpenChange(false)}
						projectId={projectId}
					/>
				) : null}
			</ResponsiveDialogContent>
		</ResponsiveDialog>
	);
}

function MoveDialogBody({
	feedbackId,
	onClose,
	projectId,
}: {
	feedbackId: Id<'feedback'>;
	onClose: () => void;
	projectId: Id<'projects'>;
}) {
	const params = useParams({ from: ROUTE });
	const navigate = useNavigate();
	const move = useMutation(nativeApi.forumMoves.moveFromFeedback);
	const categoriesQuery = useQuery(convexQuery(nativeApi.forumCategories.list, { projectId }));
	const categories = categoriesQuery.data ?? [];
	const [categoryId, setCategoryId] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit() {
		if (!categoryId) return;
		setError(null);
		setBusy(true);
		try {
			const { topicSlug } = await move({
				feedbackId,
				categoryId: categoryId as Id<'forumCategories'>,
			});
			onClose();
			await navigate({
				params: { org: params.org, project: params.project, slug: topicSlug },
				to: '/@{$org}/$project/forum/$slug',
			});
		} catch (mutationError) {
			setError(localizeError(mutationError, m.feedback_move_to_forum_failed()));
		} finally {
			setBusy(false);
		}
	}

	return (
		<>
			<ResponsiveDialogBody className='flex flex-col gap-3'>
				<div className='space-y-2'>
					<p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
						{m.feedback_move_to_forum_category()}
					</p>
					{categoriesQuery.isPending ? (
						<p className='text-sm text-muted-foreground'>{m.forum_loading()}</p>
					) : categories.length ? (
						<Select
							disabled={busy}
							items={categories.map((category) => ({ label: category.name, value: category.id }))}
							onValueChange={(next) => next !== null && setCategoryId(next)}
							value={categoryId}
						>
							<SelectTrigger className='w-full'>
								<SelectValue placeholder={m.forum_new_category_placeholder()} />
							</SelectTrigger>
							<SelectContent>
								{categories.map((category) => (
									<SelectItem key={category.id} value={category.id}>
										<BoardIcon className='size-3.5' icon={category.icon} name={category.name} />
										{category.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : (
						<p className='text-sm text-muted-foreground'>
							{m.feedback_move_to_forum_no_categories()}
						</p>
					)}
				</div>
				{error ? <InlineAlert variant='danger'>{error}</InlineAlert> : null}
			</ResponsiveDialogBody>
			<ResponsiveDialogFooter>
				<Button disabled={busy} onClick={onClose} size='sm' variant='outline'>
					{m.common_cancel()}
				</Button>
				<Button disabled={!categoryId || busy} onClick={() => void submit()} size='sm'>
					<MessagesSquare />
					{busy ? m.feedback_moving_to_forum() : m.feedback_move_to_forum_submit()}
				</Button>
			</ResponsiveDialogFooter>
		</>
	);
}
