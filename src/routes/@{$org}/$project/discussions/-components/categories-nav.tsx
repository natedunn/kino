import { useMemo } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Lock } from 'lucide-react';

import { BoardIcon } from '@/components/board-icon';
import { useRegisterShortcuts } from '@/components/shortcuts';
import { SidebarNavGroup, SidebarNavItem } from '@/components/sidebar-nav';
import * as m from '@/paraglide/messages.js';

import { withCategory } from './list-search';

// Single shortcut covering 1–9; the digit pressed selects the category at that
// position in the list below (1 = All), mirroring the Feedback boards nav.
const CATEGORY_SELECT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export type DiscussionCategoryNavItem = {
	id: string;
	name: string;
	slug: string;
	icon: string | null;
	format: 'open' | 'qa';
	postingPolicy: 'everyone' | 'team';
};

export function CategoriesNav({
	categories,
	org,
	project,
	selectedSlug,
}: {
	categories: Array<DiscussionCategoryNavItem>;
	org: string;
	project: string;
	/** The resolved category slug; `undefined` means "All". */
	selectedSlug: string | undefined;
}) {
	const navigate = useNavigate();
	// `slug: undefined` is the synthetic "All" entry (no `category` search param).
	const entries = useMemo(
		() => [
			{
				format: undefined,
				icon: 'box',
				id: 'all',
				name: m.discussions_category_all(),
				postingPolicy: 'everyone' as const,
				slug: undefined,
			},
			...categories,
		],
		[categories]
	);

	const shortcuts = useMemo(
		() => [
			{
				group: 'Navigation' as const,
				id: 'discussions.select-category',
				keys: CATEGORY_SELECT_KEYS,
				label: '1–9',
				description: m.discussions_category_select_shortcut(),
				run: ({ key }: { key: string }) => {
					const target = entries.at(Number(key) - 1);
					if (!target) return;
					void navigate({
						params: { org, project },
						search: (prev) => withCategory(prev, target),
						to: '/@{$org}/$project/discussions',
					});
				},
			},
		],
		[entries, navigate, org, project]
	);

	useRegisterShortcuts('discussions-categories', shortcuts);

	return (
		<SidebarNavGroup>
			{entries.map((category) => (
				<Link
					key={category.id}
					params={{ org, project }}
					search={(prev) => withCategory(prev, category)}
					to='/@{$org}/$project/discussions'
				>
					<SidebarNavItem
						active={category.slug === selectedSlug}
						icon={<BoardIcon icon={category.icon} name={category.name} size='16px' />}
					>
						<span className='inline-flex items-center gap-2'>
							{category.name}
							{category.postingPolicy === 'team' ? (
								<span className='text-muted-foreground' title={m.discussions_category_team_only()}>
									<Lock aria-hidden='true' className='size-3' />
									<span className='sr-only'>{m.discussions_category_team_only()}</span>
								</span>
							) : null}
						</span>
					</SidebarNavItem>
				</Link>
			))}
		</SidebarNavGroup>
	);
}
