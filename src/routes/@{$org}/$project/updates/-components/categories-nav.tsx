import { Link, useParams, useSearch } from '@tanstack/react-router';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { CATEGORY_CONFIG } from './category-badge';

const categories = [
  { label: 'All', slug: 'all' },
  { label: CATEGORY_CONFIG.changelog.label, slug: 'changelog' },
  { label: CATEGORY_CONFIG.article.label, slug: 'article' },
  { label: CATEGORY_CONFIG.announcement.label, slug: 'announcement' },
] as const;

export function CategoriesNav() {
  const routePath = '/@{$org}/$project/updates/';
  const { org, project } = useParams({ from: routePath });
  const { category: categoryParam } = useSearch({ from: routePath });

  return (
    <div className="flex flex-col gap-1">
      {categories.map((category) => {
        const active = category.slug === (categoryParam ?? 'all');
        return (
          <Link
            key={category.slug}
            params={{ org, project }}
            search={(prev) => ({
              ...prev,
              category: category.slug === 'all' ? undefined : category.slug,
            })}
            to="/@{$org}/$project/updates"
          >
            <span
              className={cn(
                active
                  ? buttonVariants({ variant: 'outline', className: 'pointer-events-none' })
                  : buttonVariants({ variant: 'ghost' }),
                'inline-flex! w-full items-center justify-start text-left'
              )}
            >
              {category.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
