import { createFileRoute } from '@tanstack/react-router';
import { CirclePlus } from 'lucide-react';

import { Button } from '@/components/ui/button';

import BoardsMenu from './-components/boards-menu';
import { FeedbackCard } from './-components/feedback-card';

export const Route = createFileRoute('/_default/$team/$project/feedback/')({
	component: RouteComponent,
});

function RouteComponent() {
	const { team, project } = Route.useParams();

	return (
		<div className='container overflow-visible'>
			<div className='grid-cols-12 gap-10 py-6 md:grid'>
				<div className='md:col-span-3'>
					<div className='sticky top-6 flex flex-col overflow-hidden rounded-lg border'>
						<div className='border-b bg-muted p-4'>
							<Button className='w-full'>
								<CirclePlus size={16} /> Add feedback
							</Button>
						</div>
						<div className='p-4'>
							<span className='text-sm font-bold text-muted-foreground'>Boards</span>
							<div className='mt-2'>
								<BoardsMenu />
							</div>
						</div>
					</div>
				</div>
				<div className='flex flex-col gap-4 md:col-span-9'>
					<div className='overflow-shidden rounded-lg border border-primary bg-gradient-to-bl from-primary/10 to-primary/20 p-6'>
						<h1 className='text-2xl font-bold text-primary dark:text-foreground'>
							We want to hear your feedback
						</h1>
						<div className='text-foreground/50'>
							Make sure to read the feedback rules and guidelines before posting.
						</div>
					</div>
					<FeedbackCard team={team} project={project} />
					<FeedbackCard team={team} project={project} />
					<FeedbackCard team={team} project={project} />
					<FeedbackCard team={team} project={project} />
					<FeedbackCard team={team} project={project} />
					<FeedbackCard team={team} project={project} />
					<FeedbackCard team={team} project={project} />
					<FeedbackCard team={team} project={project} />
					<FeedbackCard team={team} project={project} />
				</div>
			</div>
		</div>
	);
}
