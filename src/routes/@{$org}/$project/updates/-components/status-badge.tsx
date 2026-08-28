import { Badge } from '@/components/ui/badge';
import * as m from '@/paraglide/messages.js';

export function StatusBadge({ status }: { status: 'draft' | 'published' }) {
	if (status === 'published') {
		return (
			<Badge
				className='bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
				variant='outline'
			>
				{m.updates_status_published()}
			</Badge>
		);
	}

	return (
		<Badge
			className='bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
			variant='outline'
		>
			{m.updates_status_draft()}
		</Badge>
	);
}
