import { Link, useParams, useSearch } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';

import { API } from '~api';
import { buttonVariants } from '@/components/ui/button';
import { Icon, IconKey } from '@/icons';
import { cn } from '@/lib/utils';

type BoardNavProps = {
	boards: NonNullable<API['feedbackBoard']['listProjectBoards']> | null;
};

export const BoardsNav = ({ boards }: BoardNavProps) => {
	const routePath = '/@{$org}/$project/feedback/';
	const { org, project } = useParams({
		from: routePath,
	});

	const { board: boardParam } = useSearch({
		from: routePath,
	});

	if (!boards) {
		return <div>No boards</div>;
	}

	const allBoards = [
		{
			_id: 'all',
			name: 'All',
			icon: 'box',
			slug: 'all',
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
						search={(prev) => ({
							...prev,
							board: board.slug,
						})}
					>
						{({ isActive }) => {
							const active = board.slug === boardParam || isActive;
							return (
								<span
									className={cn(
										active
											? buttonVariants({
													variant: 'outline',
													// Kinda hacky way to keep the style
													className: 'pointer-events-none',
												})
											: buttonVariants({
													variant: 'ghost',
												}),
										'group inline-flex! w-full items-center justify-start text-left'
									)}
								>
									<span className='mr-auto inline-flex items-center gap-3'>
										{board?.icon ? (
											<Icon size='16px' name={board?.icon as IconKey} />
										) : (
											<Icon size='16px' name='box' />
										)}
										{/* <Box className='text-muted-foreground' /> */}
										<span>{board.name}</span>
									</span>
									<ChevronRight
										className={cn(
											active
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
