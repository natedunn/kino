import { convexQuery } from '@convex-dev/react-query';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import * as z from 'zod';

import { api } from '~api';
import { RoutePending } from '@/components/route-pending';
import { Button } from '@/components/ui/button';
import { updateSelectSchema } from '@/convex/schema/update.schema';
import CalendarDays from '@/icons/calendar-days';
import CirclePlusOutline from '@/icons/circle-plus-outline';
import LoaderQuarter from '@/icons/loader-quarter';
import Missing from '@/icons/missing';

import { CategoriesNav } from './-components/categories-nav';
import { UpdateCard } from './-components/update-card';

const updatesSearchParams = z.object({
	category: z.optional(
		updateSelectSchema.shape.category.transform((val) => (val?.trim() === '' ? undefined : val))
	),
});

export const Route = createFileRoute('/@{$org}/$project/updates/')({
	validateSearch: updatesSearchParams,
	component: RouteComponent,
	pendingComponent: () => <RoutePending variant='sidebar' />,
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

		await context.queryClient.ensureQueryData(
			convexQuery(api.update.listByProject, {
				projectId: projectData.project._id,
			})
		);
	},
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
	const { category: categoryParam } = Route.useSearch();

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
		throw notFound();
	}

	// Get current user's profile for like functionality
	const { data: currentProfile } = useQuery(convexQuery(api.profile.findMyProfile, {}));

	// Handle case where updatesData is an empty array (project not found)
	const allUpdates = Array.isArray(updatesData) ? [] : updatesData.updates;
	const canEdit = Array.isArray(updatesData) ? false : updatesData.canEdit;

	// Filter by category
	const updates = categoryParam
		? allUpdates.filter((u) => u.category === categoryParam)
		: allUpdates;

	return (
		<div className='container h-full overflow-visible'>
			<div className='h-full grid-cols-12 gap-8 md:grid'>
				{/* Right sidebar */}
				<div className='order-first border-l border-border/75 py-6 md:order-last md:col-span-3'>
					<div className='sticky top-6 flex flex-col overflow-hidden'>
						{canEdit && (
							<div className='border-b pb-6 pl-6'>
								<Button size='lg' className='w-full' asChild>
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
							</div>
						)}
						<div className={canEdit ? 'mt-4' : ''}>
							<div className='pb-6 pl-6'>
								<h2 className='mx-2 text-sm font-bold text-muted-foreground'>Categories</h2>
								<div className='mt-2'>
									<CategoriesNav />
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Main content */}
				<div className='flex flex-col gap-4 py-8 md:col-span-9' aria-live='polite' aria-busy={isLoading}>
					{/* Header */}
					<div className='flex items-start gap-3 border-b pt-6 pb-6 md:-mr-8.25'>
						<CalendarDays size='28px' className='mt-1 text-muted-foreground' />
						<div className='flex flex-col gap-1'>
							<h1 className='text-3xl font-bold'>Updates</h1>
							<p className='text-muted-foreground'>The latest news and announcements.</p>
						</div>
					</div>

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
