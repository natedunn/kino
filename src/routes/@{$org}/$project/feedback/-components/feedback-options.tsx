import { Link, useParams } from '@tanstack/react-router';
import { LayoutDashboard } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import * as m from '@/paraglide/messages.js';

export function FeedbackOptions() {
	const { org, project } = useParams({ from: '/@{$org}/$project/feedback/' });

	return (
		<div className='flex flex-col gap-2'>
			<Link
				className={buttonVariants({
					variant: 'ghost',
					className: 'group inline-flex! justify-start! gap-2 px-2 text-left',
				})}
				params={{ org, project }}
				to='/@{$org}/$project/settings/boards'
			>
				<span className='opacity-60 transition-opacity group-hover:opacity-100'>
					<LayoutDashboard className='size-4 shrink-0' />
				</span>
				<span>{m.feedback_index_edit_boards()}</span>
			</Link>
		</div>
	);
}
