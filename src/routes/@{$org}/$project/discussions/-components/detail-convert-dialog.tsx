import type { Id } from '../../../../../../convex/native/_generated/dataModel';

import { useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { ArrowRightLeft } from 'lucide-react';

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

import { api as nativeApi } from '../../../../../../convex/native/_generated/api';

const ROUTE = '/@{$org}/$project/discussions/$slug/' as const;

// Turns the discussion into a feedback item on the chosen board, then opens it.
export function DetailConvertDialog({
	discussionId,
	onOpenChange,
	open,
	projectId,
}: {
	discussionId: Id<'discussions'>;
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
					icon={<ArrowRightLeft />}
					subtitle={m.discussions_detail_convert_description()}
					title={m.discussions_detail_convert()}
				/>
				{/* Only mounted while open, so closing resets the board choice. */}
				{open ? (
					<ConvertDialogBody
						discussionId={discussionId}
						onClose={() => onOpenChange(false)}
						projectId={projectId}
					/>
				) : null}
			</ResponsiveDialogContent>
		</ResponsiveDialog>
	);
}

function ConvertDialogBody({
	discussionId,
	onClose,
	projectId,
}: {
	discussionId: Id<'discussions'>;
	onClose: () => void;
	projectId: Id<'projects'>;
}) {
	const params = useParams({ from: ROUTE });
	const navigate = useNavigate();
	const convert = useMutation(nativeApi.discussions.convertToFeedback);
	const boardsQuery = useQuery(convexQuery(nativeApi.feedbackBoards.list, { projectId }));
	const boards = boardsQuery.data ?? [];
	const [boardId, setBoardId] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit() {
		if (!boardId) return;
		setError(null);
		setBusy(true);
		try {
			const { feedbackSlug } = await convert({
				discussionId,
				boardId: boardId as Id<'feedbackBoards'>,
			});
			onClose();
			await navigate({
				params: { org: params.org, project: params.project, slug: feedbackSlug },
				to: '/@{$org}/$project/feedback/$slug',
			});
		} catch (mutationError) {
			setError(localizeError(mutationError, m.discussions_detail_convert_failed()));
		} finally {
			setBusy(false);
		}
	}

	return (
		<>
			<ResponsiveDialogBody className='flex flex-col gap-3'>
				<div className='space-y-2'>
					<p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
						{m.discussions_detail_convert_board()}
					</p>
					{boardsQuery.isPending ? (
						<p className='text-sm text-muted-foreground'>{m.discussions_loading()}</p>
					) : boards.length ? (
						<Select
							disabled={busy}
							items={boards.map((board) => ({ label: board.name, value: board.id }))}
							onValueChange={(next) => next !== null && setBoardId(next)}
							value={boardId}
						>
							<SelectTrigger className='w-full'>
								<SelectValue placeholder={m.discussions_detail_convert_board_placeholder()} />
							</SelectTrigger>
							<SelectContent>
								{boards.map((board) => (
									<SelectItem key={board.id} value={board.id}>
										<BoardIcon className='size-3.5' icon={board.icon} name={board.name} />
										{board.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : (
						<p className='text-sm text-muted-foreground'>
							{m.discussions_detail_convert_no_boards()}
						</p>
					)}
				</div>
				{error ? <InlineAlert variant='danger'>{error}</InlineAlert> : null}
			</ResponsiveDialogBody>
			<ResponsiveDialogFooter>
				<Button disabled={busy} onClick={onClose} size='sm' variant='outline'>
					{m.common_cancel()}
				</Button>
				<Button disabled={!boardId || busy} onClick={() => void submit()} size='sm'>
					<ArrowRightLeft />
					{busy ? m.discussions_detail_converting() : m.discussions_detail_convert_submit()}
				</Button>
			</ResponsiveDialogFooter>
		</>
	);
}
