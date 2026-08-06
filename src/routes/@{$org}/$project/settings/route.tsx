import { useQuery } from '@tanstack/react-query';
import {
	createFileRoute,
	Link,
	notFound,
	Outlet,
	redirect,
	useRouterState,
} from '@tanstack/react-router';
import { GitBranch, LayoutDashboard, Palette, Settings, TriangleAlert, Users } from 'lucide-react';

import { SidebarNavGroup, SidebarNavItem, SidebarNavSelect } from '@/components/sidebar-nav';
import { EditingBar } from '@/components/site-nav/editing-bar';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/@{$org}/$project/settings')({
	head: () => ({
		meta: [titleMeta(['Settings'])],
	}),
	// Gate the settings shell on the content/settings capabilities. Child
	// navigation is filtered further for access, integration, and deletion
	// capabilities. Archived projects remain read-only server-side.
	loader: async ({ context, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({
				orgSlug: params.org,
				slug: params.project,
			})
		);

		if (!projectData?.project) {
			throw notFound();
		}

		if (!projectData.permissions.canEditSettings && !projectData.permissions.canManageContent) {
			throw redirect({
				to: '/@{$org}/$project',
				params: { org: params.org, project: params.project },
			});
		}
	},
	component: ProjectSettingsRoute,
});

function ProjectSettingsRoute() {
	const params = Route.useParams();
	const crpc = useCRPC();
	const projectQuery = useQuery(
		crpc.project.getDetails.queryOptions(
			{
				orgSlug: params.org,
				slug: params.project,
			},
			{ subscribe: false }
		)
	);
	const permissions = projectQuery.data?.permissions;
	const linkParams = {
		org: params.org,
		project: params.project,
	};
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	const items = [
		{
			icon: Settings,
			label: 'General',
			to: '/@{$org}/$project/settings/general' as const,
			visible: permissions?.canEditSettings,
		},
		{
			icon: LayoutDashboard,
			label: 'Boards',
			to: '/@{$org}/$project/settings/boards' as const,
			visible: permissions?.canManageContent,
		},
		{
			icon: Palette,
			label: 'Appearance',
			to: '/@{$org}/$project/settings/appearance' as const,
			visible: permissions?.canEditSettings,
		},
		{
			icon: Users,
			label: 'Members',
			to: '/@{$org}/$project/settings/members' as const,
			visible: permissions?.canManageAccess,
		},
		{
			icon: GitBranch,
			label: 'Integrations',
			to: '/@{$org}/$project/settings/integrations' as const,
			visible: permissions?.canManageIntegrations,
		},
		{
			icon: TriangleAlert,
			label: 'Danger',
			to: '/@{$org}/$project/settings/danger' as const,
			visible: permissions?.canDelete,
		},
	].filter((item) => item.visible);
	const navItems = items.map((item) => {
		const Icon = item.icon;
		const path = item.to.replace('/@{$org}', `/@${params.org}`).replace('$project', params.project);
		const active = pathname === path || pathname.startsWith(`${path}/`);

		return {
			active,
			icon: <Icon className='size-4' />,
			key: item.to,
			label: item.label,
			renderLink: (children: React.ReactNode) => (
				<Link params={(prev) => ({ ...prev, ...linkParams })} to={item.to}>
					{children}
				</Link>
			),
		};
	});

	return (
		<>
			<EditingBar />
			<div className='container flex flex-1 flex-col overflow-visible'>
				<div className='py-4 md:hidden'>
					<SidebarNavSelect items={navItems} />
				</div>
				<div className='flex flex-1 flex-col gap-8 md:grid md:grid-cols-12'>
					<div className='hidden py-8 md:col-span-3 md:block md:border-r md:border-border/75'>
						<div className='sticky top-6 flex flex-col overflow-hidden'>
							<SidebarNavGroup className='border-b pb-6 md:pr-6' title='Settings'>
								{items.map((item) => {
									const Icon = item.icon;

									return (
										<Link
											key={item.to}
											params={(prev) => ({ ...prev, ...linkParams })}
											to={item.to}
										>
											{({ isActive }) => (
												<SidebarNavItem active={isActive} icon={<Icon className='size-4' />}>
													{item.label}
												</SidebarNavItem>
											)}
										</Link>
									);
								})}
							</SidebarNavGroup>
						</div>
					</div>
					<div className='flex flex-col gap-4 py-8 md:col-span-9'>
						<Outlet />
					</div>
				</div>
			</div>
		</>
	);
}
