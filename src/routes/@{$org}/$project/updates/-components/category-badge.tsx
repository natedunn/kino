import { type UpdateCategory } from '@/convex/schema/update.schema';
import { cn } from '@/lib/utils';

const CATEGORY_CONFIG: Record<
	UpdateCategory,
	{
		label: string;
		className: string;
	}
> = {
	changelog: {
		label: 'Changelog',
		className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
	},
	article: {
		label: 'Article',
		className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
	},
	announcement: {
		label: 'Announcement',
		className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
	},
};

type CategoryBadgeProps = {
	category: UpdateCategory;
	className?: string;
};

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
	const config = CATEGORY_CONFIG[category];

	return (
		<span
			className={cn(
				'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
				config.className,
				className
			)}
		>
			<span className='size-1.5 rounded-full bg-current' aria-hidden='true' />
			{config.label}
		</span>
	);
}

export { CATEGORY_CONFIG };
