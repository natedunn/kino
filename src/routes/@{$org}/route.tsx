import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, notFound, Outlet, useParams } from '@tanstack/react-router';

import { DefaultCatchBoundary } from '@/components/_default-catch-boundary';
import { NotFound } from '@/components/_not-found';
import { AppShell } from '@/components/app-shell';
import { MainNav } from '@/components/site-nav/main-nav';
import { ProjectThemeBoundary, resolveProjectTheme } from '@/lib/project-theme';
import { titleFromSlug, titleMeta } from '@/lib/seo';

import { api as nativeApi } from '../../../convex/native/_generated/api';
import { DynamicNavigation } from './$project/-components/dynamic-nav';

export const Route = createFileRoute('/@{$org}')({
	head: ({ params }) => ({
		meta: [titleMeta([titleFromSlug(params.org)])],
	}),
	loader: async ({ context, params }) => {
		const [organization] = await Promise.all([
			context.queryClient.ensureQueryData(
				convexQuery(nativeApi.organizations.getBySlug, { slug: params.org })
			),
			context.queryClient.ensureQueryData(convexQuery(nativeApi.profiles.me, {})),
		]);
		if (!organization) throw notFound();
	},
	component: OrganizationShell,
	notFoundComponent: () => <NotFound isContainer />,
	errorComponent: DefaultCatchBoundary,
});

function OrganizationShell() {
	return <NativeOrganizationShell />;
}

function NativeOrganizationShell() {
	const params = Route.useParams();
	const projectParams = useParams({
		from: '/@{$org}/$project',
		shouldThrow: false,
	});
	const { data: organization } = useSuspenseQuery(
		convexQuery(nativeApi.organizations.getBySlug, { slug: params.org })
	);
	const { data: profile } = useSuspenseQuery(convexQuery(nativeApi.profiles.me, {}));
	if (!organization) throw notFound();
	if (projectParams?.project) {
		return (
			<NativeProjectShell
				organization={organization}
				profile={profile}
				projectSlug={projectParams.project}
			/>
		);
	}
	return (
		<AppShell
			nav={
				<MainNav
					context={{
						org: { name: organization.name, slug: organization.slug, logo: organization.logo },
						type: 'org',
					}}
					user={profile}
				/>
			}
		>
			<div className='flex flex-1 flex-col'>
				<Outlet />
			</div>
		</AppShell>
	);
}

function NativeProjectShell({
	organization,
	profile,
	projectSlug,
}: {
	organization: { logo?: string | null; name: string; slug: string };
	profile: { username: string; imageUrl?: string | null } | null;
	projectSlug: string;
}) {
	const { data: projectDetails } = useSuspenseQuery(
		convexQuery(nativeApi.projects.getBySlugs, {
			organizationSlug: organization.slug,
			projectSlug,
		})
	);
	if (!projectDetails?.project) throw notFound();
	const publishedTheme = projectDetails.publishedTheme
		? resolveProjectTheme(projectDetails.publishedTheme)
		: null;
	return (
		<ProjectThemeBoundary key={projectSlug} theme={publishedTheme}>
			<AppShell
				nav={
					<MainNav
						context={{
							org: organization,
							projectSlug,
							type: 'project',
						}}
						subNav={
							<DynamicNavigation
								orgSlug={organization.slug}
								projectSlug={projectSlug}
								canManageSettings={projectDetails.permissions.canEditSettings}
							/>
						}
						user={profile}
					/>
				}
			>
				<div className='flex flex-1 flex-col'>
					<Outlet />
				</div>
			</AppShell>
		</ProjectThemeBoundary>
	);
}
