import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { FileText } from 'lucide-react';

import { api } from '~api';
import { Button } from '@/components/ui/button';
import CirclePlusOutline from '@/icons/circle-plus-outline';
import LoaderQuarter from '@/icons/loader-quarter';
import Missing from '@/icons/missing';

import { UpdateCard } from './-components/update-card';

export const Route = createFileRoute('/@{$org}/$project/updates/')({
	loader: async ({ context, params }) => {
		const project = await context.queryClient.ensureQueryData(
			convexQuery(api.project.getDetails, {
				orgSlug: params.org,
				slug: params.project,
			})
		);

		if (project?.project?._id) {
			await context.queryClient.ensureQueryData(
				convexQuery(api.update.listByProject, {
					projectId: project.project._id,
				})
			);
		}

		return { project };
	},
	component: RouteComponent,
});

const Notice = ({ icon, children }: { icon: React.JSX.Element; children: React.ReactNode }) => {
	return (
		<div className='text-bold flex items-center justify-center gap-3 rounded-lg border bg-muted p-4 text-xl text-muted-foreground md:p-10'>
			<div>{icon}</div>
			<div>{children}</div>
		</div>
	);
};

function RouteComponent() {
	const router = useRouter();
	const { org: orgSlug, project: projectSlug } = Route.useParams();

	const { data: projectData } = useSuspenseQuery(
		convexQuery(api.project.getDetails, {
			orgSlug,
			slug: projectSlug,
		})
	);

	const { data: updatesData, isLoading } = useSuspenseQuery(
		convexQuery(api.update.listByProject, {
			projectId: projectData?.project?._id!,
		})
	);

	if (!projectData?.project?._id) {
		return null;
	}

	// Handle case where updatesData is an empty array (project not found)
	const updates = Array.isArray(updatesData) ? [] : updatesData.updates;
	const canEdit = Array.isArray(updatesData) ? false : updatesData.canEdit;

	return (
		<div className='container h-full overflow-visible'>
			<div className='h-full py-8'>
				<div className='mb-6 flex items-center justify-between'>
					<div className='flex items-start gap-4'>
						<div className='mt-1'>
							<FileText className='size-8 text-primary dark:text-blue-300' aria-hidden='true' />
						</div>
						<div>
							<h1 className='text-2xl font-bold'>Updates</h1>
							<p className='text-muted-foreground'>
								Stay up to date with the latest news and releases.
							</p>
						</div>
					</div>
					{canEdit && (
						<Button asChild>
							<Link
								to='/@{$org}/$project/updates/new'
								params={{
									org: orgSlug,
									project: projectSlug,
								}}
							>
								<CirclePlusOutline size='16px' /> New Update
							</Link>
						</Button>
					)}
				</div>

				<div aria-live='polite' aria-busy={isLoading}>
					{updates.length === 0 && !isLoading ? (
						<Notice icon={<Missing size='32px' aria-hidden='true' />}>
							No updates yet.
						</Notice>
					) : null}
					{updates.length === 0 && isLoading ? (
						<Notice
							icon={
								<LoaderQuarter
									className='animate-spin'
									size='32px'
									role='status'
									aria-label='Loading'
								/>
							}
						>
							Loading updates...
						</Notice>
					) : null}
					{updates.length > 0 ? (
						<ul className='flex flex-col gap-4'>
							{updates.map((update) => (
								<UpdateCard
									key={update._id}
									update={update}
									onNavigationClick={() =>
										router.navigate({
											to: '/@{$org}/$project/updates/$slug',
											params: {
												org: orgSlug,
												project: projectSlug,
												slug: update.slug,
											},
										})
									}
								/>
							))}
						</ul>
					) : null}
				</div>
			</div>
		</div>
	);
}
