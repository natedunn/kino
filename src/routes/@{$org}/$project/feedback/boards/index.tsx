import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Box } from 'lucide-react';

import { api } from '~api';
import { buttonVariants } from '@/components/ui/button';
import { Icon, IconName } from '@/icons';
import Eye from '@/icons/eye';
import Pen from '@/icons/pen';
import VArrowRight from '@/icons/v-arrow-right';

export const Route = createFileRoute('/@{$org}/$project/feedback/boards/')({
	component: RouteComponent,
});

function RouteComponent() {
	const { org, project } = Route.useParams();

	const { data: boards } = useSuspenseQuery(
		convexQuery(api.feedbackBoard.listProjectBoards, {
			slug: project,
		})
	)

	return (
		<div className='flex flex-1 flex-col'>
			<div className='overflow-hidden border-b bg-muted/50 pt-12 pb-6'>
				<div className='relative container flex items-center justify-between'>
					<div className='relative'>
						<h1 className='relative z-10 flex items-center gap-2 text-3xl font-bold'>
							<span className='text-muted-foreground'>Feedback</span>
							<VArrowRight size='20px' className='text-muted-foreground' /> Boards
						</h1>
						<h1 className='absolute top-10 scale-250 text-3xl font-bold opacity-50 blur-xl select-none'>
							<span className='text-muted-foreground'>Feedback</span>
							<VArrowRight size='20px' className='text-muted-foreground' /> Boards
						</h1>
					</div>
					<div>
						<div className='relative inline-flex items-stretch justify-stretch'>
							<Link
								to='/@{$org}/$project/feedback/boards/new'
								className={buttonVariants({
									variant: 'default',
									className: 'relative z-10',
								})}
								params={{
									org,
									project,
								}}
							>
								Create board
							</Link>
							<div className='absolute inset-0 translate-y-10 scale-250 bg-blue-500 opacity-20 blur-xl'></div>
						</div>
					</div>
				</div>
			</div>
			<div className='container py-4'>
				<div className='mt-8 grid grid-cols-12 gap-6'>
					{!boards?.map ? (
						<div>No boards have been create yet.</div>
					) : (
						boards?.map((board) => {
							return (
								<div key={board._id} className='col-span-12 md:col-span-6'>
									<div className='flex h-full flex-col justify-center gap-2 rounded-lg border bg-muted p-6'>
										<div className='flex items-start gap-6'>
											<div className='mt-1'>
												<Icon size='32px' name={board?.icon as IconName} fallback='box' />
											</div>
											<div className='flex flex-col gap-1'>
												<span className='text-lg font-bold'>{board.name}</span>
												<span className='text-muted-foreground'>
													{board.description ?? (
														<span className='opacity-50'>No description added</span>
													)}
												</span>
												<div className='mt-4 flex items-center gap-4'>
													<Link
														className='link-text flex items-center gap-2'
														to='/@{$org}/$project/feedback/boards/$board/edit'
														params={{
															org,
															project,
															board: board._id,
														}}
													>
														<Pen className='text-muted-foreground' size='14px' />
														Edit
													</Link>
													<Link
														className='link-text flex items-center gap-2'
														to='/@{$org}/$project/feedback'
														params={{
															org,
															project,
														}}
														search={{
															board: board.slug,
															search: undefined,
														}}
													>
														<Eye className='text-muted-foreground' size='14px' />
														View
													</Link>
												</div>
											</div>
										</div>
									</div>
								</div>
							)
						})
					)}
				</div>
			</div>
		</div>
	)
}
