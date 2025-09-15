import { Link, useParams } from '@tanstack/react-router';
import { FeedbackBoardSelectSchema } from 'convex/schema/feedbackBoard.schema';
import { Box, ChevronRight } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type BoardNavProps = {
	boards: FeedbackBoardSelectSchema[] | null;
};

export const BoardsNav = ({ boards }: BoardNavProps) => {
	const { org, project } = useParams({
		from: '/@{$org}/$project/feedback/',
	});

	if (!boards) {
		return <div>No boards</div>;
	}

	const allBoards = [
		{
			_id: 'all',
			name: 'All',
		},
		...boards,
	];
	return (
		<div className='flex flex-col gap-1'>
			{allBoards.map((board) => {
				return (
					<Link
						key={board._id}
						to='/@{$org}/$project/feedback'
						params={{
							org,
							project,
						}}
						search={{
							board: board._id,
						}}
					>
						{({ isActive }) => {
							return (
								<span
									className={cn(
										isActive
											? buttonVariants({
													variant: 'outline',
													// Kinda hacky way to keep the style
													className: 'pointer-events-none',
												})
											: buttonVariants({
													variant: 'ghost',
												}),
										'group !inline-flex w-full items-center justify-start text-left'
									)}
								>
									<span className='mr-auto inline-flex items-center gap-3'>
										<Box className='text-muted-foreground' />
										<span>{board.name}</span>
									</span>
									<ChevronRight
										className={cn(
											isActive
												? 'text-foreground'
												: 'text-transparent group-hocus:text-muted-foreground'
										)}
									/>
								</span>
							);
						}}
					</Link>
				);
			})}
		</div>
	);
};
