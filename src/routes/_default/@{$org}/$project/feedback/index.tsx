import { createFileRoute } from '@tanstack/react-router';
import { CirclePlus } from 'lucide-react';

import { Button } from '@/components/ui/button';

import BoardsMenu from './-components/boards-menu';
import { FeedbackCard } from './-components/feedback-card';
import { FeedbackToolbar } from './-components/feedback-toolbar';

export const Route = createFileRoute('/_default/@{$org}/$project/feedback/')({
	component: RouteComponent,
});

function RouteComponent() {
	const { org, project } = Route.useParams();

	return (
		<div className='container h-full overflow-visible'>
			<div className='h-full grid-cols-12 gap-8 md:grid'>
				<div className='border-r border-border/75 py-6 pr-8 md:col-span-3'>
					<div className='sticky top-6 flex flex-col overflow-hidden'>
						<div>
							<Button className='w-full'>
								<CirclePlus size={16} /> Add feedback
							</Button>
						</div>
						<div className='mt-4'>
							<span className='text-sm font-bold text-muted-foreground'>Feedback boards</span>
							<div className='mt-2'>
								<BoardsMenu />
							</div>
						</div>
					</div>
				</div>
				<div className='flex flex-col gap-4 py-8 md:col-span-9'>
					<div className='overflow-shidden rounded-lg border border-primary bg-gradient-to-bl from-primary/10 to-primary/20 p-8'>
						<h1 className='text-2xl font-bold text-primary dark:text-foreground'>
							We want to hear your feedback
						</h1>
						<div className='text-foreground/50'>
							Make sure to read the feedback rules and guidelines before posting.
						</div>
					</div>
					<FeedbackToolbar />
					<FeedbackCard orgSlug={org} projectSlug={project} />
					<FeedbackCard orgSlug={org} projectSlug={project} />
					<FeedbackCard orgSlug={org} projectSlug={project} />
					<FeedbackCard orgSlug={org} projectSlug={project} />
					<FeedbackCard orgSlug={org} projectSlug={project} />
					<FeedbackCard orgSlug={org} projectSlug={project} />
					<FeedbackCard orgSlug={org} projectSlug={project} />
					<FeedbackCard orgSlug={org} projectSlug={project} />
					<FeedbackCard orgSlug={org} projectSlug={project} />
					<FeedbackCard orgSlug={org} projectSlug={project} />
				</div>
			</div>
		</div>
	);
}
