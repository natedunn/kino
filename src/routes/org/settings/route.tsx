import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Outlet, redirect, useRouterState } from '@tanstack/react-router';
import { GitBranch, Settings, Users } from 'lucide-react';

import { EmptyState } from '@/components/kino/common';
import { SidebarNavGroup, SidebarNavItem, SidebarNavSelect } from '@/components/sidebar-nav';
import { EditingBar } from '@/components/site-nav/editing-bar';
import { MainNav } from '@/components/site-nav/main-nav';
import { requireAuth } from '@/lib/auth/require-auth';
import { useAuthLostRedirect } from '@/lib/auth/use-auth-lost';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { titleMeta } from '@/lib/seo';

import { OrgSettingsSelector } from './-components/org-settings-selector';
import { useSettingsOrgController } from './-components/use-settings-org';

type SettingsSearch = { org?: string };

const navItems = [
	{
		icon: Settings,
		label: 'General',
		to: '/org/settings/general' as const,
	},
	{
		icon: Users,
		label: 'Members',
		to: '/org/settings/members' as const,
	},
	{
		icon: GitBranch,
		label: 'Integrations',
		to: '/org/settings/integrations' as const,
	},
];

export const Route = createFileRoute('/org/settings')({
	head: () => ({
		meta: [titleMeta(['Settings'])],
	}),
	validateSearch: (search: Record<string, unknown>): SettingsSearch => ({
		org: typeof search.org === 'string' ? search.org : undefined,
	}),
	beforeLoad: ({ context, location }) => requireAuth(context, location),
	loaderDeps: ({ search }) => ({ org: search.org }),
	loader: async ({ context, deps }) => {
		if (!context.loaderToken) {
			return;
		}

		await context.queryClient.ensureQueryData(
			crpcServer.org.findMyEditableOrgs.queryOptions({}, { skipUnauth: true })
		);

		// The whole org-settings area is an edit-only surface. Gate `canEdit` once
		// here so the child pages (general/members/integrations) inherit it instead
		// of each re-implementing the same redirect. Server procedures remain the
		// real boundary. Only enforceable when an org is selected via the `?org=`
		// search param; the default-org pick happens client-side in the shell.
		if (deps.org) {
			const orgData = await context.queryClient.ensureQueryData(
				crpcServer.org.getDetails.queryOptions({ slug: deps.org }, { skipUnauth: true })
			);
			if (!orgData?.permissions.canEdit) {
				throw redirect({ to: '/dashboard' });
			}
		}
	},
	component: OrgSettingsRoute,
});

function OrgSettingsRoute() {
	// Entry is gated in `beforeLoad` (requireAuth); this only catches auth lost
	// in place (sign-out), which `beforeLoad` can't see.
	const lost = useAuthLostRedirect();
	if (lost) return lost;

	return <AuthenticatedOrgSettingsShell />;
}

function AuthenticatedOrgSettingsShell() {
	const crpc = useCRPC();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const profileQuery = useSuspenseQuery(
		crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
	);
	const { activeOrg, activeSlug, isEmpty, orgs, setOrg } = useSettingsOrgController();
	// Whole settings area is an org editing surface. `findMyEditableOrgs` (backing
	// `activeOrg`) is filtered by the same `canEditOrgRole` helper that
	// `verifyOrgAccess` uses, so an org appearing here already means edit access.

	const selectItems = navItems.map((item) => {
		const Icon = item.icon;
		const active = pathname === item.to || pathname.startsWith(`${item.to}/`);

		return {
			active,
			icon: <Icon className='size-4' />,
			key: item.to,
			label: item.label,
			renderLink: (children: React.ReactNode) => (
				<Link search={(prev) => prev} to={item.to}>
					{children}
				</Link>
			),
		};
	});

	return (
		<div className='flex min-h-dvh w-full flex-col'>
			<div className='flex w-full flex-1 flex-col'>
				<MainNav context={{ type: 'global' }} isUserPending={false} user={profileQuery.data} />
				{activeOrg ? <EditingBar /> : null}
				<div className='container flex flex-1 flex-col overflow-visible'>
					{isEmpty ? (
						<div className='py-12'>
							<EmptyState
								title='No organizations to manage'
								description="You don't have edit access to any organizations yet. Ask an owner or admin to invite you, or create a team of your own."
							/>
						</div>
					) : (
						<>
							{/* Mobile: org selector + section nav collapse into dropdowns. */}
							<div className='flex flex-col gap-3 py-4 md:hidden'>
								<OrgSettingsSelector activeSlug={activeSlug} onSelect={setOrg} orgs={orgs} />
								<SidebarNavSelect items={selectItems} />
							</div>

							<div className='flex flex-1 flex-col gap-8 md:grid md:grid-cols-12'>
								{/* Desktop: persistent sidebar with the org selector on top. */}
								<div className='hidden py-8 md:col-span-3 md:block md:border-r md:border-border/75'>
									<div className='sticky top-6 flex flex-col gap-4 overflow-hidden md:pr-6'>
										<OrgSettingsSelector activeSlug={activeSlug} onSelect={setOrg} orgs={orgs} />
										<SidebarNavGroup className='border-b pb-6' title='Settings'>
											{navItems.map((item) => {
												const Icon = item.icon;

												return (
													<Link key={item.to} search={(prev) => prev} to={item.to}>
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
								<div className='flex flex-col gap-4 pb-8 md:col-span-9 md:py-8'>
									<Outlet />
								</div>
							</div>
						</>
					)}
				</div>
			</div>
			<footer className='mt-auto w-full border-t border-border py-4 text-center text-sm text-muted-foreground'>
				<div className='container'>
					<p>© {new Date().getFullYear()} Kino</p>
				</div>
			</footer>
		</div>
	);
}
