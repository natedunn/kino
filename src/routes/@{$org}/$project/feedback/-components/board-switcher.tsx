import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';

import { api } from '~api';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Id } from '@/convex/_generated/dataModel';
import { Icon, IconName } from '@/icons';
import LoaderQuarter from '@/icons/loader-quarter';
import { cn } from '@/lib/utils';

type Board = {
	_id: Id<'feedbackBoard'>;
	name: string;
	slug: string;
	icon?: string;
};

type BoardSwitcherProps = {
	feedbackId: Id<'feedback'>;
	currentBoard: Board | null;
	projectSlug: string;
	canEdit: boolean;
};

export function BoardSwitcher({
	feedbackId,
	currentBoard,
	projectSlug,
	canEdit,
}: BoardSwitcherProps) {
	const { data: boards } = useSuspenseQuery(
		convexQuery(api.feedbackBoard.listProjectBoards, { slug: projectSlug })
	);

	const { mutate: updateBoard, status: mutationStatus } = useMutation({
		mutationFn: useConvexMutation(api.feedback.updateBoard),
	});

	const isUpdating = mutationStatus === 'pending';

	const handleBoardChange = (boardId: Id<'feedbackBoard'>) => {
		if (boardId !== currentBoard?._id) {
			updateBoard({ _id: feedbackId, boardId });
		}
	};

	if (!currentBoard) {
		return <span className='text-sm text-muted-foreground'>None</span>;
	}

	if (!canEdit) {
		return (
			<span className='flex items-center gap-1.5 text-sm'>
				<Icon size='14px' name={currentBoard.icon as IconName} fallback='box' />
				{currentBoard.name}
			</span>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant='ghost'
					size='sm'
					disabled={isUpdating}
					className='h-auto gap-1.5 px-1.5 py-0.5 text-sm hover:bg-accent'
				>
					{isUpdating ? (
						<>
							<LoaderQuarter size='14px' className='animate-spin' />
							Updating...
						</>
					) : (
						<>
							<Icon size='14px' name={currentBoard.icon as IconName} fallback='box' />
							{currentBoard.name}
							<ChevronDown size={12} />
						</>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end'>
				{boards?.map((board) => (
					<DropdownMenuItem
						key={board._id}
						onClick={() => handleBoardChange(board._id)}
						className={cn('cursor-pointer gap-2', {
							'font-semibold': board._id === currentBoard._id,
						})}
					>
						<Icon size='14px' name={board.icon as IconName} fallback='box' />
						{board.name}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
