import { Link, useParams, useSearch } from '@tanstack/react-router';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { CATEGORY_CONFIG } from './category-badge';

const categories = [
	{ slug: 'all', label: 'All' },
	{ slug: 'changelog', label: CATEGORY_CONFIG.changelog.label },
	{ slug: 'article', label: CATEGORY_CONFIG.article.label },
	{ slug: 'announcement', label: CATEGORY_CONFIG.announcement.label },
] as const;

export function CategoriesNav() {
	const routePath = '/@{$org}/$project/updates/';
	const { org, project } = useParams({
		from: routePath,
	});

	const { category: categoryParam } = useSearch({
		from: routePath,
	});

	return (
		<div className='flex flex-col gap-1'>
			{categories.map((cat) => {
				const active = cat.slug === (categoryParam ?? 'all');
				return (
					<Link
						key={cat.slug}
						to='/@{$org}/$project/updates'
						params={{ org, project }}
						search={(prev) => ({
							...prev,
							category: cat.slug === 'all' ? undefined : cat.slug,
						})}
					>
						<span
							className={cn(
								active
									? buttonVariants({
											variant: 'outline',
											className: 'pointer-events-none',
										})
									: buttonVariants({
											variant: 'ghost',
										}),
								'inline-flex! w-full items-center justify-start text-left'
							)}
						>
							{cat.label}
						</span>
					</Link>
				);
			})}
		</div>
	);
}
