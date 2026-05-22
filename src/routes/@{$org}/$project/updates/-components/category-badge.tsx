import { cn } from '@/lib/utils';

export type UpdateCategory = 'announcement' | 'article' | 'changelog';

const CATEGORY_CONFIG: Record<
  UpdateCategory,
  {
    className: string;
    label: string;
  }
> = {
  announcement: {
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    label: 'Announcement',
  },
  article: {
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    label: 'Article',
  },
  changelog: {
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    label: 'Changelog',
  },
};

export function CategoryBadge({
  category,
  className,
}: {
  category: UpdateCategory;
  className?: string;
}) {
  const config = CATEGORY_CONFIG[category];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}

export { CATEGORY_CONFIG };
