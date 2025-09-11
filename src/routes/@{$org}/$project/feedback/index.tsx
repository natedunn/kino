import { convexQuery } from '@convex-dev/react-query';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { ClientOnly, createFileRoute, Link } from '@tanstack/react-router';
import { CirclePlus, Megaphone, SquareArrowOutUpRight } from 'lucide-react';
import z from 'zod';

import { api } from '~api';
import { InlineAlert } from '@/components/inline-alert';
import { Button, buttonVariants } from '@/components/ui/button';

import { BoardsNav } from './-components/boards-nav';
import { FeedbackCard } from './-components/feedback-card';
import { FeedbackOptions } from './-components/feedback-options';
import { FeedbackToolbar } from './-components/feedback-toolbar';

const feedbackSearchParams = z.object({
	board: z.string().default('all'),
});

export const Route = createFileRoute('/@{$org}/$project/feedback/')({
	validateSearch: feedbackSearchParams.parse,
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(
			convexQuery(api.features.feedback, {
				projectSlug: params.project,
			})
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { org: orgSlug, project: projectSlug } = Route.useParams();

	const { data: feedback } = useSuspenseQuery(
		convexQuery(api.features.feedback, {
			projectSlug,
		})
	);

	// const { data: projectData } = useQuery(
	// 	convexQuery(api.project.getFullProject, {
	// 		orgSlug,
	// 		slug: projectSlug,
	// 	})
	// );

	// if (!feedback) {
	// 	return (
	// 		<div className='container py-6'>
	// 			<InlineAlert variant='danger'>There was an error loading the feedback page</InlineAlert>
	// 		</div>
	// 	);
	// }

	return (
		<div className='container h-full overflow-visible'>
			<div className='h-full grid-cols-12 gap-8 md:grid'>
				<div className='border-r border-border/75 py-6 md:col-span-3'>
					<div className='sticky top-6 flex flex-col overflow-hidden'>
						<div className='border-b pr-8 pb-6'>
							<Button className='w-full' asChild>
								<Link
									to='/@{$org}/$project/feedback/new'
									params={{
										org: orgSlug,
										project: projectSlug,
									}}
								>
									<CirclePlus size={16} /> Add feedback
								</Link>
							</Button>
						</div>
						<div className='mt-4'>
							<div className='border-b pr-8 pb-6'>
								<span className='mx-2 inline-flex text-sm font-bold text-muted-foreground'>
									Boards
								</span>
								<div className='mt-2'>
									{feedback?.boards ? (
										<ClientOnly fallback={<div>Loading...</div>}>
											<BoardsNav boards={feedback.boards} />
										</ClientOnly>
									) : null}
								</div>
							</div>
							{/* {projectData?.isProjectAdmin && (
								<div className='mt-6 pr-8'>
									<span className='mx-2 inline-flex text-sm font-bold text-muted-foreground'>
										Options
									</span>
									<div className='mt-2'>
										<FeedbackOptions />
									</div>
								</div>
							)} */}
						</div>
					</div>
				</div>
				<div className='flex flex-col gap-4 py-8 md:col-span-9'>
					<div className='overflow-hidden rounded-lg border border-primary/50 bg-gradient-to-tl from-primary/20 to-primary/5 p-8'>
						<div className='flex items-start gap-4'>
							<div className='mt-1'>
								<Megaphone className='size-8 text-primary/75 dark:text-blue-300' />
							</div>
							<div>
								<h1 className='text-2xl font-bold text-primary dark:text-blue-50'>
									We want to hear your feedback
								</h1>
								<p className='text-primary/75 dark:text-blue-300'>
									Make sure to read the feedback rules and guidelines before posting.
								</p>
							</div>
						</div>
					</div>
					<FeedbackToolbar />
					<FeedbackCard orgSlug={orgSlug} projectSlug={projectSlug} />
					{/* <FeedbackCard orgSlug={Route.useParams().org} projectSlug={Route.useParams().project} />
					<FeedbackCard orgSlug={Route.useParams().org} projectSlug={Route.useParams().project} />
					<FeedbackCard orgSlug={Route.useParams().org} projectSlug={Route.useParams().project} />
					<FeedbackCard orgSlug={Route.useParams().org} projectSlug={Route.useParams().project} />
					<FeedbackCard orgSlug={Route.useParams().org} projectSlug={Route.useParams().project} />
					<FeedbackCard orgSlug={Route.useParams().org} projectSlug={Route.useParams().project} />
					<FeedbackCard orgSlug={Route.useParams().org} projectSlug={Route.useParams().project} /> */}
				</div>
			</div>
		</div>
	);
}
