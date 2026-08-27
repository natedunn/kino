import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Link, useRouterState } from '@tanstack/react-router';
import { Blocks, Cookie, FileWarning, ShieldCheck, Users } from 'lucide-react';

import { SidebarNavGroup, SidebarNavItem, SidebarNavSelect } from '@/components/sidebar-nav';
import { PublicMainNav } from '@/components/site-nav/public-main-nav';

type DocsRoute =
	| '/docs/community-guidelines'
	| '/docs/cookies'
	| '/docs/development'
	| '/docs/privacy'
	| '/docs/stack';

type DocsNavGroup = {
	title: string;
	items: ReadonlyArray<{
		icon: LucideIcon;
		label: string;
		to: DocsRoute;
	}>;
};

const NAV_GROUPS: ReadonlyArray<DocsNavGroup> = [
	{
		title: 'Notices',
		items: [
			{ icon: ShieldCheck, label: 'Privacy policy', to: '/docs/privacy' },
			{ icon: FileWarning, label: 'Development notice', to: '/docs/development' },
			{
				icon: Users,
				label: 'Community guidelines',
				to: '/docs/community-guidelines',
			},
			{ icon: Cookie, label: 'Cookie policy', to: '/docs/cookies' },
		],
	},
	{
		title: 'Technology',
		items: [{ icon: Blocks, label: 'Tech stack', to: '/docs/stack' }],
	},
];

const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export function DocsShell({ children }: { children: ReactNode }) {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const selectItems = NAV_ITEMS.map((item) => {
		const Icon = item.icon;

		return {
			active: pathname === item.to,
			icon: <Icon className='size-4' />,
			key: item.to,
			label: item.label,
			renderLink: (content: ReactNode) => <Link to={item.to}>{content}</Link>,
		};
	});

	return (
		<div className='flex min-h-dvh w-full flex-col'>
			<div className='flex w-full flex-1 flex-col'>
				<PublicMainNav />
				<div className='container flex flex-1 flex-col overflow-visible'>
					<div className='py-4 md:hidden'>
						<SidebarNavSelect items={selectItems} />
					</div>

					<div className='flex flex-1 flex-col gap-8 md:grid md:grid-cols-12'>
						<aside className='hidden py-8 md:col-span-3 md:block md:border-r md:border-border/75'>
							<div className='sticky top-6 flex flex-col gap-6 overflow-hidden md:pr-6'>
								{NAV_GROUPS.map((group, groupIndex) => (
									<SidebarNavGroup
										key={group.title}
										className={
											groupIndex < NAV_GROUPS.length - 1 ? '-mr-6 border-b pr-6 pb-6' : undefined
										}
										title={group.title}
									>
										{group.items.map((item) => {
											const Icon = item.icon;

											return (
												<Link key={item.to} to={item.to}>
													<SidebarNavItem
														active={pathname === item.to}
														icon={<Icon className='size-4' />}
													>
														{item.label}
													</SidebarNavItem>
												</Link>
											);
										})}
									</SidebarNavGroup>
								))}
							</div>
						</aside>

						<main className='flex flex-col pb-8 md:col-span-9 md:py-8'>{children}</main>
					</div>
				</div>
			</div>

			<footer className='mt-auto w-full border-t border-border py-4 text-sm text-muted-foreground'>
				<div className='container flex items-center justify-between gap-4'>
					<p>© {new Date().getFullYear()} Kino</p>
					<Link to='/docs/notices' className='transition-colors hocus:text-foreground'>
						Notices
					</Link>
				</div>
			</footer>
		</div>
	);
}
