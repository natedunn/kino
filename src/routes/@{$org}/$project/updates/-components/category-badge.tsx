import { BookOpen, Megaphone, ScrollText } from 'lucide-react';

import { type UpdateCategory } from '@/convex/schema/update.schema';
import { cn } from '@/lib/utils';

const CATEGORY_CONFIG: Record<
	UpdateCategory,
	{
		label: string;
		icon: typeof ScrollText;
		className: string;
	}
> = {
	changelog: {
		label: 'Changelog',
		icon: ScrollText,
		className:
			'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
	},
	article: {
		label: 'Article',
		icon: BookOpen,
		className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
	},
	announcement: {
		label: 'Announcement',
		icon: Megaphone,
		className:
			'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
	},
};

type CategoryBadgeProps = {
	category: UpdateCategory;
	className?: string;
};

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
	const config = CATEGORY_CONFIG[category];
	const Icon = config.icon;

	return (
		<span
			className={cn(
				'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
				config.className,
				className
			)}
		>
			<Icon className='size-3' aria-hidden='true' />
			{config.label}
		</span>
	);
}

export { CATEGORY_CONFIG };
