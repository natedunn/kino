import { convexQuery } from '@convex-dev/react-query';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
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

	// Get current user's profile for like functionality
	const { data: currentProfile } = useQuery(convexQuery(api.profile.findMyProfile, {}));

	if (!projectData?.project?._id) {
		return null;
	}

	// Handle case where updatesData is an empty array (project not found)
	const updates = Array.isArray(updatesData) ? [] : updatesData.updates;
	const canEdit = Array.isArray(updatesData) ? false : updatesData.canEdit;

	return (
		<div>
			{/* Header */}
			<header className='w-full border-b bg-muted/50'>
				<div className='container pt-16 pb-6'>
					<div className='mx-auto max-w-240 px-4'>
					<div className='flex items-start justify-between gap-4'>
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
					</div>
				</div>
			</header>

			{/* Content */}
			<div className='container py-10'>
				<div className='mx-auto max-w-240 px-4' aria-live='polite' aria-busy={isLoading}>
					{updates.length === 0 && !isLoading ? (
						<Notice icon={<Missing size='32px' aria-hidden='true' />}>No updates yet.</Notice>
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
						<ul className='flex flex-col'>
							{updates.map((update, index) => (
								<UpdateCard
									key={update._id}
									update={update}
									orgSlug={orgSlug}
									projectSlug={projectSlug}
									currentProfileId={currentProfile?._id}
									isLast={index === updates.length - 1}
								/>
							))}
						</ul>
					) : null}
				</div>
			</div>
		</div>
	);
}
