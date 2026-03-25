import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Navigate, notFound, useRouter } from '@tanstack/react-router';
import { FileText } from 'lucide-react';

import { api } from '~api';
import { RoutePending } from '@/components/route-pending';
import { Id } from '@/convex/_generated/dataModel';

import { CreateUpdateForm } from './-components/create-update-form';

export const Route = createFileRoute('/@{$org}/$project/updates/new/')({
	pendingComponent: () => <RoutePending variant='form' />,
	pendingMs: 150,
	loader: async ({ context, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			convexQuery(api.project.getDetails, {
				orgSlug: params.org,
				slug: params.project,
			})
		);

		if (!projectData?.project?._id) {
			throw notFound();
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	const router = useRouter();
	const { org: orgSlug, project: projectSlug } = Route.useParams();

	const { data: projectData } = useSuspenseQuery(
		convexQuery(api.project.getDetails, {
			orgSlug,
			slug: projectSlug,
		})
	);

	if (!projectData?.permissions?.canEdit) {
		return (
			<Navigate
				to='/@{$org}/$project/updates'
				params={{
					org: orgSlug,
					project: projectSlug,
				}}
			/>
		);
	}

	if (!projectData?.project?._id) {
		return null;
	}

	const handleSubmit = (data: { updateId: Id<'update'>; slug: string }) => {
		router.navigate({
			to: '/@{$org}/$project/updates/$slug',
			params: {
				org: orgSlug,
				project: projectSlug,
				slug: data.slug,
			},
		});
	};

	return (
		<div className='container py-8'>
			<div className='mx-auto max-w-2xl'>
				<div className='mb-8 flex items-start gap-4'>
					<div className='mt-1'>
						<FileText className='size-8 text-primary dark:text-blue-300' aria-hidden='true' />
					</div>
					<div>
						<h1 className='text-2xl font-bold'>Create Update</h1>
						<p className='text-muted-foreground'>
							Write a new update for your project.
						</p>
					</div>
				</div>
				<CreateUpdateForm projectId={projectData.project._id} onSubmit={handleSubmit} />
			</div>
		</div>
	);
}
