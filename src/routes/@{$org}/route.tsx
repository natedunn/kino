import { useQuery } from '@tanstack/react-query';
import { createFileRoute, notFound, Outlet, useParams } from '@tanstack/react-router';

import { DefaultCatchBoundary } from '@/components/_default-catch-boundary';
import { NotFound } from '@/components/_not-found';
import { AppShell } from '@/components/app-shell';
import { MainNav } from '@/components/site-nav/main-nav';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { ProjectThemeBoundary, resolveProjectTheme } from '@/lib/project-theme';
import { titleFromSlug, titleMeta } from '@/lib/seo';

import { DynamicNavigation } from './$project/-components/dynamic-nav';

export const Route = createFileRoute('/@{$org}')({
	head: ({ params }) => ({
		meta: [titleMeta([titleFromSlug(params.org)])],
	}),
	loader: async ({ context, params }) => {
		const orgDetails = await context.queryClient.ensureQueryData(
			crpcServer.org.getDetails.queryOptions({ slug: params.org })
		);

		if (!orgDetails?.org) {
			throw notFound();
		}
	},
	component: OrganizationShell,
	notFoundComponent: () => <NotFound isContainer />,
	errorComponent: DefaultCatchBoundary,
});

function OrganizationShell() {
	const crpc = useCRPC();
	const params = Route.useParams();
	const { loaderToken } = Route.useRouteContext();
	const projectParams = useParams({
		from: '/@{$org}/$project',
		shouldThrow: false,
	});
	const profileQuery = useQuery(
		crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true, subscribe: false })
	);
	const orgQuery = useQuery(
		crpc.org.getDetails.queryOptions({ slug: params.org }, { subscribe: false })
	);
	const projectSlug = projectParams?.project;
	const projectQuery = useQuery(
		crpc.project.getDetails.queryOptions(
			{ orgSlug: params.org, slug: projectSlug ?? '' },
			{ enabled: !!projectSlug }
		)
	);

	if (orgQuery.isSuccess && !orgQuery.data?.org) {
		throw notFound();
	}

	const isUserPending =
		!!loaderToken && (profileQuery.isPending || profileQuery.data === undefined);
	const org =
		orgQuery.data?.org ??
		({
			logo: null,
			name: params.org,
			slug: params.org,
		} as const);
	const navContext = projectSlug
		? ({
				org,
				projectSlug,
				type: 'project',
			} as const)
		: ({
				org,
				type: 'org',
			} as const);

	const shell = (
		<AppShell
			nav={
				<MainNav
					context={navContext}
					isUserPending={isUserPending}
					subNav={
						projectSlug ? (
							<DynamicNavigation orgSlug={params.org} projectSlug={projectSlug} />
						) : undefined
					}
					user={profileQuery.data}
				/>
			}
		>
			<div className='flex flex-1 flex-col'>
				<Outlet />
			</div>
		</AppShell>
	);
	if (!projectSlug) return shell;
	const publishedTheme = projectQuery.data?.publishedTheme
		? resolveProjectTheme(projectQuery.data.publishedTheme)
		: null;
	return (
		<ProjectThemeBoundary key={projectSlug} theme={publishedTheme}>
			{shell}
		</ProjectThemeBoundary>
	);
}
