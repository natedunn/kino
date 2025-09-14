import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Box, Edit } from 'lucide-react';

import { api } from '~api';
import { buttonVariants } from '@/components/ui/button';

export const Route = createFileRoute('/@{$org}/$project/feedback/boards/')({
	component: RouteComponent,
});

function RouteComponent() {
	const { org, project } = Route.useParams();

	if (!org || !project) {
	}

	const { data: feedback } = useSuspenseQuery(
		convexQuery(api.features.feedback, {
			projectSlug: Route.useParams().project,
		})
	);

	const boards = feedback?.boards;

	if (!boards) throw new Error('No boards found');

	return (
		<div className='container py-12'>
			<div className='flex justify-between'>
				<h1 className='text-3xl font-bold'>Boards</h1>
				<div>
					<Link
						to='/@{$org}/$project/feedback/board/new'
						className={buttonVariants({
							variant: 'default',
						})}
						params={{
							org,
							project,
						}}
					>
						Create board
					</Link>
				</div>
			</div>
			<div className='mt-8 grid grid-cols-12 gap-6'>
				{boards.map((board) => {
					return (
						<div key={board._id} className='col-span-6'>
							<div className='flex h-full flex-col justify-center gap-2 rounded-lg border bg-muted p-6'>
								<div className='flex items-start gap-6'>
									<div className='mt-1'>
										<Box className='size-8 text-muted-foreground' />
									</div>
									<div className='flex flex-col gap-1'>
										<Link
											to='/@{$org}/$project/feedback'
											params={{
												org,
												project,
											}}
											search={{
												board: board._id,
											}}
											className='link-text text-xl font-bold'
										>
											{board.name}
										</Link>
										<span className='text-muted-foreground'>
											{board.description ?? (
												<span className='opacity-50'>No description added</span>
											)}
										</span>
										<div className='mt-4'>
											<Link
												className={buttonVariants({
													variant: 'outline',
													size: 'sm',
													className: 'inline-flex items-center gap-2',
												})}
												to='/@{$org}/$project/feedback/board/$board/edit'
												params={{
													org,
													project,
													board: board._id,
												}}
											>
												<Edit />
												Edit
											</Link>
										</div>
									</div>
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
