import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';

import { api } from '~api';

import { CreateFeedbackForm } from './-components/create-feedback-form';

export const Route = createFileRoute('/@{$org}/$project/feedback/new/')({
	component: RouteComponent,
});

function RouteComponent() {
	const router = useRouter();
	const { org: orgSlug, project: projectSlug } = Route.useParams();

	const { data: projectDetails } = useSuspenseQuery(
		convexQuery(api.project.getDetails, {
			orgSlug,
			slug: projectSlug,
		})
	);

	const { data: feedbackBoards } = useSuspenseQuery(
		convexQuery(api.feedbackBoard.getProjectBoards, {
			projectSlug,
		})
	);

	if (!projectDetails?.project) {
		throw new Error('Project not found: 019a6be9');
	}

	return (
		<div>
			<div className='border-b bg-muted/50'>
				<div className='container pt-12 pb-6'>
					<div className='flex items-center justify-between'>
						<div className='flex items-center gap-3'>
							<h1 className='text-2xl font-bold md:text-3xl'>Add Feedback</h1>
						</div>
					</div>
				</div>
			</div>
			<div className='container py-6'>
				<CreateFeedbackForm
					projectId={projectDetails.project._id}
					boards={feedbackBoards}
					onSubmit={({ feedbackId }) => {
						router.navigate({
							to: '/@{$org}/$project/feedback/$feedbackId',
							params: {
								org: orgSlug,
								project: projectSlug,
								feedbackId,
							},
						});
					}}
				/>
			</div>
		</div>
	);
}
