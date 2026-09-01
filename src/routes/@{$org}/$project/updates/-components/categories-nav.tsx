import { Link, useParams, useSearch } from '@tanstack/react-router';

import { SidebarNavGroup, SidebarNavItem } from '@/components/sidebar-nav';
import * as m from '@/paraglide/messages.js';

import { CATEGORY_CONFIG } from './category-badge';

const categories = [
	{ label: m.updates_all, slug: 'all' },
	{ label: CATEGORY_CONFIG.changelog.label, slug: 'changelog' },
	{ label: CATEGORY_CONFIG.article.label, slug: 'article' },
	{ label: CATEGORY_CONFIG.announcement.label, slug: 'announcement' },
] as const;

export function CategoriesNav() {
	const routePath = '/@{$org}/$project/updates/';
	const { org, project } = useParams({ from: routePath });
	const { category: categoryParam } = useSearch({ from: routePath });

	return (
		<SidebarNavGroup>
			{categories.map((category) => {
				const active = category.slug === (categoryParam ?? 'all');
				return (
					<Link
						className='group block rounded-lg focus-visible:outline-none'
						key={category.slug}
						params={{ org, project }}
						search={(prev) => ({
							...prev,
							category: category.slug === 'all' ? undefined : category.slug,
						})}
						to='/@{$org}/$project/updates'
					>
						<SidebarNavItem active={active}>{category.label()}</SidebarNavItem>
					</Link>
				);
			})}
		</SidebarNavGroup>
	);
}
