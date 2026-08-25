import { useQuery } from '@tanstack/react-query';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { StorageBreakdown, StorageSummary } from '@/components/storage-usage';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/@{$org}/$project/settings/storage/')({
	head: () => ({ meta: [titleMeta(['Storage Settings'])] }),
	loader: async ({ context, params }) => {
		const data = await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({ orgSlug: params.org, slug: params.project })
		);
		if (!data?.project) throw notFound();
	},
	component: ProjectStorageSettings,
});

function ProjectStorageSettings() {
	const params = Route.useParams();
	const crpc = useCRPC();
	const details = useQuery(
		crpc.project.getDetails.queryOptions({ orgSlug: params.org, slug: params.project })
	);
	const projectId = details.data?.project?.id ?? '';
	const usage = useQuery(
		crpc.file.getProjectUsage.queryOptions(
			{ projectId },
			{ enabled: !!projectId, skipUnauth: true }
		)
	);
	if (details.isPending || usage.isPending)
		return <div className='h-48 animate-pulse rounded-xl bg-muted' />;
	if (!details.data?.project) throw notFound();
	if (usage.error) throw usage.error;
	const data = usage.data;
	return (
		<div className='space-y-6'>
			<header className='border-b pb-4'>
				<h2 className='text-xl font-semibold'>Storage</h2>
				<p className='mt-1 text-sm text-muted-foreground'>
					Hosted staff and user uploads share this project’s free-tier storage limit.
				</p>
			</header>
			<StorageSummary
				fileCount={data.fileCount}
				limitBytes={data.limitBytes}
				reservedBytes={data.reservedBytes}
				usedBytes={data.usedBytes}
			/>
			<div className='grid gap-6 lg:grid-cols-3'>
				<StorageBreakdown title='By file category' breakdown={data.byCategory} />
				<StorageBreakdown title='By original feature' breakdown={data.byOrigin} />
				<StorageBreakdown title='By uploader class' breakdown={data.byUploaderClass} />
			</div>
		</div>
	);
}
